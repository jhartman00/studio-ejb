"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { bumpCampaigns } from "@/lib/cache";
import { sendEmail } from "@/lib/email/client";
import {
  campaignFooterHtml,
  campaignFooterText,
  isPlaceholderAddress,
  unsubscribeUrl,
  oneClickUnsubscribeUrl,
} from "@/lib/email/templates";
import { sanitizeHtml } from "@/lib/sanitize";
import { optionalId, requiredId } from "@/lib/zod-helpers";

function originMatchesHeaders(h: Headers): boolean {
  const host = h.get("host");
  if (!host) return false;
  const origin = h.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const ref = h.get("referer");
  if (!ref) return true;
  try {
    return new URL(ref).host === host;
  } catch {
    return false;
  }
}

const draftSchema = z.object({
  id: optionalId,
  subject: z.string().min(1).max(998).refine((s) => !/[\r\n]/.test(s), "no line breaks"),
  preheader: z.string().max(300).optional().nullable(),
  body_html: z.string().min(1).max(200000),
});

export type CampaignResult =
  | { ok: true; id: number }
  | { ok: false; error: string };

export async function campaignDraftAction(
  raw: z.input<typeof draftSchema>,
): Promise<CampaignResult> {
  const h = await headers();
  if (!originMatchesHeaders(h)) return { ok: false, error: "bad origin" };
  const adm = await requireAdmin();
  if (!adm.ok) return { ok: false, error: "not authenticated" };

  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const v = parsed.data;
  const safeHtml = sanitizeHtml(v.body_html);

  try {
    if (v.id) {
      const { rows } = await sql<{ id: number }>`
        update email_campaigns set
          subject = ${v.subject},
          preheader = ${v.preheader ?? null},
          body_html = ${safeHtml}
        where id = ${v.id} and status in ('draft','failed')
        returning id
      `;
      if (rows.length === 0) return { ok: false, error: "cannot edit a sent or in-progress campaign" };
      bumpCampaigns();
      return { ok: true, id: rows[0]!.id };
    }
    const { rows } = await sql<{ id: number }>`
      insert into email_campaigns (subject, preheader, body_html, status)
      values (${v.subject}, ${v.preheader ?? null}, ${safeHtml}, 'draft')
      returning id
    `;
    bumpCampaigns();
    return { ok: true, id: rows[0]!.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const testSendSchema = z.object({
  id: requiredId,
  toEmail: z.string().email().max(254),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function campaignTestSendAction(
  raw: z.input<typeof testSendSchema>,
): Promise<ActionResult> {
  const h = await headers();
  if (!originMatchesHeaders(h)) return { ok: false, error: "bad origin" };
  const adm = await requireAdmin();
  if (!adm.ok) return { ok: false, error: "not authenticated" };

  const parsed = testSendSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  const { rows } = await sql<{
    subject: string;
    preheader: string | null;
    body_html: string;
  }>`
    select subject, preheader, body_html from email_campaigns where id = ${parsed.data.id}
  `;
  const c = rows[0];
  if (!c) return { ok: false, error: "campaign not found" };

  const addr = process.env.STUDIO_MAILING_ADDRESS || "";
  // Test sends still include the footer so Emma can verify it looks right.
  const safeAddr = isPlaceholderAddress(addr) ? "[placeholder — set STUDIO_MAILING_ADDRESS]" : addr;
  const unsub = unsubscribeUrl("test-token-placeholder");
  const oneClick = oneClickUnsubscribeUrl("test-token-placeholder");
  const footerHtml = campaignFooterHtml({ studioMailingAddress: safeAddr, unsubscribeUrl: unsub });
  const footerText = campaignFooterText({ studioMailingAddress: safeAddr, unsubscribeUrl: unsub });

  const safeBody = sanitizeHtml(c.body_html);
  const html = `${c.preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${c.preheader.replace(/[<>]/g, "")}</div>` : ""}<div style="background:#fff3cd;border:1px solid #d4a017;padding:8px 12px;margin-bottom:16px;font-family:sans-serif;font-size:13px;">TEST SEND. Footer placeholders will be filled per-recipient on the real blast.</div>${safeBody}${footerHtml}`;
  const text = `[TEST SEND]\n\n${c.body_html.replace(/<[^>]+>/g, "")}${footerText}`;

  const res = await sendEmail({
    to: parsed.data.toEmail,
    subject: `[TEST] ${c.subject}`,
    html,
    text,
    headers: {
      "List-Unsubscribe": `<${oneClick}>, <${unsub}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    idempotencyKey: `test:${parsed.data.id}:${Date.now()}`,
  });
  if (!res.ok) return { ok: false, error: res.error };

  // Track that a successful test send happened — gates the real send button.
  await sql`
    update email_campaigns
    set heartbeat_at = now()
    where id = ${parsed.data.id}
  `;
  bumpCampaigns();
  return { ok: true };
}
