import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getGalleryItems } from "@/lib/db/queries";
import DeleteButton from "./DeleteButton";

export const dynamic = "force-dynamic";

export default async function AdminGallery() {
  const adm = await requireAdmin();
  if (!adm.ok) redirect("/admin/login");
  const items = await getGalleryItems().catch(() => []);

  return (
    <>
      <div className="section-header">
        <h1 style={{ margin: 0 }}>Gallery</h1>
        <a href="/admin/gallery/new" className="btn">Add gallery item</a>
      </div>
      {items.length === 0 ? (
        <div className="empty-state">
          <p>No gallery items yet.</p>
          <p>
            <a href="/admin/gallery/new" className="btn">Add your first piece</a>
          </p>
        </div>
      ) : (
        <div className="admin-list">
          {items.map((g) => (
            <div key={g.id} className="admin-list-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.image_url} alt="" />
              <div style={{ flex: 1 }}>
                <strong>{g.title}</strong>
                <div className="meta">{g.tag} · {g.slug}</div>
                <div className="actions">
                  <a href={`/admin/gallery/${g.id}`} className="btn">Edit</a>
                  <DeleteButton id={g.id} title={g.title} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
