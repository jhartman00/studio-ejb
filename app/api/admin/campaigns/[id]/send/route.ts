import { NextResponse, type NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";
import { requireAdmin, checkOrigin, ADMIN_COOKIE_NAME } from "@/lib/auth";
import { sql, transaction } from "@/lib/db";
import { bumpCampaigns } from "@/lib/cache";
import { isPlaceholderAddress } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const adm = await requireAdmin(req);
  if (!adm.ok) return NextResponse.json({ error: adm.reason }, { status: 401 });
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: "bad origin" }, { status: 403 });
  }

  const { id: idParam } = await ctx.params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  // CAN-SPAM gate. Refuse to send without a real postal address.
  if (isPlaceholderAddress(process.env.STUDIO_MAILING_ADDRESS)) {
    return NextResponse.json(
      { error: "STUDIO_MAILING_ADDRESS is missing or looks like a placeholder. Update it before sending." },
      { status: 400 },
    );
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not set in this environment." },
      { status: 400 },
    );
  }

  let total = 0;
  try {
    total = await transaction(async (tx) => {
      const status = await tx.query(
        "select status from email_campaigns where id = $1",
        [id],
      );
      const row = status.rows[0] as { status: string } | undefined;
      if (!row) throw new Error("campaign not found");
      if (!["draft", "failed", "queued"].includes(row.status)) {
        throw new Error(`campaign already ${row.status}`);
      }

      const ins = await tx.query(
        `
        insert into email_campaign_recipients (campaign_id, subscriber_id)
        select $1, id from email_subscribers where status = 'active'
        on conflict (campaign_id, subscriber_id) do nothing
        `,
        [id],
      );

      const countRes = await tx.query(
        "select count(*)::text as c from email_campaign_recipients where campaign_id = $1",
        [id],
      );
      const totalRecipients = Number(
        (countRes.rows[0] as { c: string } | undefined)?.c ?? "0",
      );

      await tx.query(
        `
        update email_campaigns set
          status = 'queued',
          total_recipients = $2,
          heartbeat_at = now()
        where id = $1
        `,
        [id, totalRecipients],
      );

      void ins;
      return totalRecipients;
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  bumpCampaigns();

  if (total === 0) {
    await sql`update email_campaigns set status = 'sent', sent_at = now(), heartbeat_at = null where id = ${id}`;
    bumpCampaigns();
    return NextResponse.json({ queued: false, total: 0, message: "no active subscribers" });
  }

  // Kick off the first drain in the background. The drain endpoint
  // self-schedules subsequent batches.
  const cookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const drainUrl = new URL(`/api/admin/campaigns/${id}/drain`, req.url);
  waitUntil(
    fetch(drainUrl.toString(), {
      method: "POST",
      headers: cookie
        ? {
            cookie: `${ADMIN_COOKIE_NAME}=${cookie}`,
            "x-forwarded-host": req.headers.get("host") ?? "",
            origin: req.nextUrl.origin,
          }
        : { origin: req.nextUrl.origin },
    }).catch((err) => console.error("[send] drain kick failed", err)),
  );

  return NextResponse.json({ queued: true, total }, { status: 202 });
}
