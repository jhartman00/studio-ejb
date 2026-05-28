import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getAllSubscribers, getSubscriberStats } from "@/lib/db/queries";
import SubscribersPanel from "./SubscribersPanel";

export const dynamic = "force-dynamic";

export default async function AdminSubscribers() {
  const adm = await requireAdmin();
  if (!adm.ok) redirect("/admin/login");
  const [subs, stats] = await Promise.all([
    getAllSubscribers().catch(() => []),
    getSubscriberStats().catch(() => ({ active: 0, addedWeek: 0, unsubbedWeek: 0 })),
  ]);
  return (
    <>
      <div className="section-header">
        <h1 style={{ margin: 0 }}>Subscribers</h1>
        <a href="/api/admin/subscribers/export" className="btn">Export CSV</a>
      </div>
      <div className="admin-tiles">
        <div className="tile">
          <span className="tile-num">{stats.active}</span>
          <span className="tile-label">Active</span>
        </div>
        <div className="tile">
          <span className="tile-num">{stats.addedWeek}</span>
          <span className="tile-label">Added this week</span>
        </div>
        <div className="tile">
          <span className="tile-num">{stats.unsubbedWeek}</span>
          <span className="tile-label">Unsubscribed this week</span>
        </div>
      </div>
      <SubscribersPanel
        subscribers={subs.map((s) => ({
          id: s.id,
          email: s.email,
          status: s.status,
          source: s.source,
          subscribed_at: s.subscribed_at,
          unsubscribed_at: s.unsubscribed_at,
        }))}
      />
    </>
  );
}
