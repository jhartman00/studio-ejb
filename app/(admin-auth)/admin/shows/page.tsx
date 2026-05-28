import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getAllShows } from "@/lib/db/queries";
import DeleteShowButton from "./DeleteShowButton";

export const dynamic = "force-dynamic";

export default async function AdminShows() {
  const adm = await requireAdmin();
  if (!adm.ok) redirect("/admin/login");
  const shows = await getAllShows().catch(() => []);
  return (
    <>
      <div className="section-header">
        <h1 style={{ margin: 0 }}>Trade shows</h1>
        <a href="/admin/shows/new" className="btn">Add show</a>
      </div>
      {shows.length === 0 ? (
        <div className="empty-state">
          <p>No shows yet.</p>
          <p>
            <a href="/admin/shows/new" className="btn">Add your first show</a>
          </p>
        </div>
      ) : (
        <div className="admin-list">
          {shows.map((s) => (
            <div key={s.id} className="admin-list-card">
              <div style={{ flex: 1 }}>
                <strong>{s.name}</strong>
                <div className="meta">
                  {new Date(s.starts_at).toLocaleDateString()} →{" "}
                  {new Date(s.ends_at).toLocaleDateString()}
                  {s.city ? ` · ${s.city}` : ""}
                </div>
                <div className="meta">
                  {s.is_published ? "Published" : "Hidden"}
                </div>
                <div className="actions">
                  <a href={`/admin/shows/${s.id}`} className="btn">Edit</a>
                  <DeleteShowButton id={s.id} name={s.name} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
