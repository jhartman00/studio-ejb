import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getGalleryItems } from "@/lib/db/queries";
import SortableList from "./SortableList";

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
        <SortableList
          initialItems={items.map((g) => ({
            id: Number(g.id),
            title: g.title,
            slug: g.slug,
            tag: g.tag,
            image_url: g.image_url,
          }))}
        />
      )}
    </>
  );
}
