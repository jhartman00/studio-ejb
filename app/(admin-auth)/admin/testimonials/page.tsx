import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getAllTestimonials } from "@/lib/db/queries";
import DeleteTestimonialButton from "./DeleteTestimonialButton";

export const dynamic = "force-dynamic";

export default async function AdminTestimonials() {
  const adm = await requireAdmin();
  if (!adm.ok) redirect("/admin/login");
  const items = await getAllTestimonials().catch(() => []);
  return (
    <>
      <div className="section-header">
        <h1 style={{ margin: 0 }}>Reviews</h1>
        <a href="/admin/testimonials/new" className="btn">Add review</a>
      </div>
      {items.length === 0 ? (
        <div className="empty-state">
          <p>No reviews yet.</p>
          <p>
            <a href="/admin/testimonials/new" className="btn">Add your first review</a>
          </p>
        </div>
      ) : (
        <div className="admin-list">
          {items.map((t) => (
            <div key={t.id} className="admin-list-card">
              <div style={{ flex: 1 }}>
                <em>"{t.quote.slice(0, 120)}{t.quote.length > 120 ? "..." : ""}"</em>
                <div className="meta">
                  {t.attribution}
                  {t.location ? ` · ${t.location}` : ""}
                </div>
                <div className="meta">
                  {t.is_published ? "Published" : "Hidden"} · order {t.display_order}
                </div>
                <div className="actions">
                  <a href={`/admin/testimonials/${t.id}`} className="btn">Edit</a>
                  <DeleteTestimonialButton id={t.id} attribution={t.attribution} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
