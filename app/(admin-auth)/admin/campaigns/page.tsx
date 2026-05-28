import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getCampaigns } from "@/lib/db/queries";
import { isPlaceholderAddress } from "@/lib/email/templates";

export const dynamic = "force-dynamic";

export default async function AdminCampaigns() {
  const adm = await requireAdmin();
  if (!adm.ok) redirect("/admin/login");
  const campaigns = await getCampaigns().catch(() => []);
  const blocked = isPlaceholderAddress(process.env.STUDIO_MAILING_ADDRESS);
  const noResend = !process.env.RESEND_API_KEY;

  return (
    <>
      <div className="section-header">
        <h1 style={{ margin: 0 }}>Campaigns</h1>
        <a href="/admin/campaigns/new" className="btn">New campaign</a>
      </div>
      {blocked ? (
        <div className="form-error" role="status">
          STUDIO_MAILING_ADDRESS is not set (or looks like a placeholder). Real
          sends are blocked until it is updated in Vercel env vars.
        </div>
      ) : null}
      {noResend ? (
        <div className="form-error" role="status">
          RESEND_API_KEY is not set. Real sends are blocked until it is added
          to Vercel env vars.
        </div>
      ) : null}
      {campaigns.length === 0 ? (
        <div className="empty-state">
          <p>No campaigns yet.</p>
          <p>
            <a href="/admin/campaigns/new" className="btn">Write your first campaign</a>
          </p>
        </div>
      ) : (
        <div className="admin-list">
          {campaigns.map((c) => (
            <div key={c.id} className="admin-list-card">
              <div style={{ flex: 1 }}>
                <strong>{c.subject}</strong>
                <div className="meta">
                  Status: {c.status} · {c.success_count}/{c.total_recipients} sent
                  {c.failure_count > 0 ? ` · ${c.failure_count} failed` : ""}
                </div>
                <div className="meta">
                  Created {new Date(c.created_at).toLocaleString()}
                  {c.sent_at ? ` · Sent ${new Date(c.sent_at).toLocaleString()}` : ""}
                </div>
                <div className="actions">
                  <a href={`/admin/campaigns/${c.id}`} className="btn">Open</a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
