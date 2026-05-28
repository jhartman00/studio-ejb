import { sql, transaction } from "@/lib/db";
import { sendEmail } from "./client";
import {
  campaignFooterHtml,
  campaignFooterText,
  unsubscribeUrl,
  oneClickUnsubscribeUrl,
} from "./templates";
import { sanitizeHtml } from "@/lib/sanitize";

export const DRAIN_BATCH = 25;
export const STUCK_THRESHOLD_SEC = 60 * 5;

type ClaimedRow = {
  id: number;
  campaign_id: number;
  subscriber_id: number;
  email: string;
  unsubscribe_token: string;
};

// Reset rows that have been stuck in 'sending' for too long back to
// pending. Runs before each batch claim.
async function resetStuck(campaignId: number) {
  await sql`
    update email_campaign_recipients
    set status = 'pending', claimed_at = null
    where campaign_id = ${campaignId}
      and status = 'sending'
      and claimed_at < now() - (${STUCK_THRESHOLD_SEC.toString()} || ' seconds')::interval
  `;
}

async function claimBatch(campaignId: number): Promise<ClaimedRow[]> {
  return transaction(async (tx) => {
    const result = await tx.query(
      `
      with claimed as (
        select id
        from email_campaign_recipients
        where campaign_id = $1 and status = 'pending'
        order by id asc
        limit $2
        for update skip locked
      )
      update email_campaign_recipients r
      set status = 'sending', claimed_at = now()
      from claimed c
      where r.id = c.id
      returning r.id, r.campaign_id, r.subscriber_id
      `,
      [campaignId, DRAIN_BATCH],
    );

    if (result.rows.length === 0) return [];

    // Join in subscriber email + unsubscribe_token for the just-claimed rows.
    const ids = result.rows.map((r) => r.id as number);
    const detailed = await tx.query(
      `
      select r.id, r.campaign_id, r.subscriber_id, s.email, s.unsubscribe_token
      from email_campaign_recipients r
      join email_subscribers s on s.id = r.subscriber_id
      where r.id = any($1::bigint[])
      `,
      [ids],
    );
    return detailed.rows as unknown as ClaimedRow[];
  });
}

async function recordResult(
  recipientId: number,
  ok: boolean,
  payload: { resendId?: string; error?: string },
) {
  if (ok) {
    await sql`
      update email_campaign_recipients
      set status = 'sent',
          resend_message_id = ${payload.resendId ?? null},
          sent_at = now()
      where id = ${recipientId}
    `;
    await sql`
      update email_campaigns
      set success_count = success_count + 1, heartbeat_at = now()
      where id = (select campaign_id from email_campaign_recipients where id = ${recipientId})
    `;
  } else {
    await sql`
      update email_campaign_recipients
      set status = 'failed', error = ${payload.error ?? "unknown"}
      where id = ${recipientId}
    `;
    await sql`
      update email_campaigns
      set failure_count = failure_count + 1, heartbeat_at = now()
      where id = (select campaign_id from email_campaign_recipients where id = ${recipientId})
    `;
  }
}

export async function drainOnce(opts: {
  campaignId: number;
  studioMailingAddress: string;
}): Promise<{ processed: number; remaining: number }> {
  await sql`
    update email_campaigns
    set heartbeat_at = now(),
        status = case when status in ('queued','sending','failed') then 'sending' else status end
    where id = ${opts.campaignId}
  `;
  await resetStuck(opts.campaignId);

  const batch = await claimBatch(opts.campaignId);
  if (batch.length === 0) {
    // No remaining work: finalize.
    const { rows: remaining } = await sql<{ pending: string }>`
      select count(*)::text as pending
      from email_campaign_recipients
      where campaign_id = ${opts.campaignId} and status in ('pending','sending')
    `;
    const pending = Number(remaining[0]?.pending ?? "0");
    if (pending === 0) {
      await sql`
        update email_campaigns
        set status = 'sent', sent_at = coalesce(sent_at, now()), heartbeat_at = null
        where id = ${opts.campaignId}
      `;
    }
    return { processed: 0, remaining: pending };
  }

  const { rows: campaignRows } = await sql<{
    subject: string;
    preheader: string | null;
    body_html: string;
  }>`
    select subject, preheader, body_html from email_campaigns where id = ${opts.campaignId}
  `;
  const cam = campaignRows[0];
  if (!cam) throw new Error(`campaign ${opts.campaignId} not found`);

  const safeBodyHtml = sanitizeHtml(cam.body_html);

  for (const row of batch) {
    const unsub = unsubscribeUrl(row.unsubscribe_token);
    const oneClick = oneClickUnsubscribeUrl(row.unsubscribe_token);
    const footerHtml = campaignFooterHtml({
      studioMailingAddress: opts.studioMailingAddress,
      unsubscribeUrl: unsub,
    });
    const footerText = campaignFooterText({
      studioMailingAddress: opts.studioMailingAddress,
      unsubscribeUrl: unsub,
    });

    const fullHtml = `${cam.preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${cam.preheader.replace(/[<>]/g, "")}</div>` : ""}${safeBodyHtml}${footerHtml}`;
    const fullText = `${cam.preheader ? `${cam.preheader}\n\n` : ""}${htmlToText(cam.body_html)}${footerText}`;

    const res = await sendEmail({
      to: row.email,
      subject: cam.subject,
      html: fullHtml,
      text: fullText,
      headers: {
        "List-Unsubscribe": `<${oneClick}>, <${unsub}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      idempotencyKey: `${opts.campaignId}:${row.id}`,
    });
    if (res.ok) {
      await recordResult(row.id, true, { resendId: res.id });
    } else {
      await recordResult(row.id, false, { error: res.error });
    }
  }

  const { rows: remaining } = await sql<{ pending: string }>`
    select count(*)::text as pending
    from email_campaign_recipients
    where campaign_id = ${opts.campaignId} and status in ('pending','sending')
  `;
  const pending = Number(remaining[0]?.pending ?? "0");

  if (pending === 0) {
    await sql`
      update email_campaigns
      set status = 'sent', sent_at = coalesce(sent_at, now()), heartbeat_at = null
      where id = ${opts.campaignId}
    `;
  }

  return { processed: batch.length, remaining: pending };
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
