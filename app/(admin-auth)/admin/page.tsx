import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDashboardCounts } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const guard = await requireAdmin();
  if (!guard.ok) redirect("/admin/login");

  let counts = { activeSubs: 0, galleryCount: 0, upcomingShows: 0 };
  let dbError: string | null = null;
  try {
    counts = await getDashboardCounts();
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  return (
    <>
      <h1 className="admin-h1">Dashboard</h1>

      {dbError ? (
        <div className="form-error" role="status">
          We could not load the live counts. Run the migration first if this is
          a new database. Error: {dbError}
        </div>
      ) : null}

      <div className="admin-tiles">
        <div className="tile">
          <span className="tile-num">{counts.activeSubs}</span>
          <span className="tile-label">Active subscribers</span>
        </div>
        <div className="tile">
          <span className="tile-num">{counts.galleryCount}</span>
          <span className="tile-label">Gallery items</span>
        </div>
        <div className="tile">
          <span className="tile-num">{counts.upcomingShows}</span>
          <span className="tile-label">Upcoming shows</span>
        </div>
      </div>

      <h2 style={{ fontSize: "var(--fs-20)", marginBottom: "var(--s-12)" }}>
        Pages
      </h2>
      <div className="admin-cards">
        <a href="/admin/pages/home" className="admin-card">
          <h3>Home</h3>
          <span className="meta">Hero, featured, studio note, newsletter</span>
        </a>
        <a href="/admin/pages/about" className="admin-card">
          <h3>About</h3>
          <span className="meta">Bio, portrait, find-me-at links</span>
        </a>
        <a href="/admin/pages/contact" className="admin-card">
          <h3>Contact</h3>
          <span className="meta">Intro and contact methods</span>
        </a>
        <a href="/admin/pages/gallery" className="admin-card">
          <h3>Gallery intro</h3>
          <span className="meta">Page intro copy</span>
        </a>
        <a href="/admin/pages/shows" className="admin-card">
          <h3>Shows intro</h3>
          <span className="meta">Page intro copy</span>
        </a>
        <a href="/admin/pages/reviews" className="admin-card">
          <h3>Reviews intro</h3>
          <span className="meta">Page intro copy</span>
        </a>
      </div>

      <div className="section-header">
        <h2>Content</h2>
      </div>
      <div className="admin-cards">
        <a href="/admin/gallery" className="admin-card">
          <h3>Gallery items</h3>
          <span className="meta">Add, edit, delete gallery pieces</span>
        </a>
        <a href="/admin/shows" className="admin-card">
          <h3>Trade shows</h3>
          <span className="meta">Upcoming and past shows</span>
        </a>
        <a href="/admin/testimonials" className="admin-card">
          <h3>Reviews</h3>
          <span className="meta">Testimonial cards</span>
        </a>
      </div>

      <div className="section-header">
        <h2>Audience</h2>
      </div>
      <div className="admin-cards">
        <a href="/admin/subscribers" className="admin-card">
          <h3>Subscribers</h3>
          <span className="meta">Email list, manual add, CSV export</span>
        </a>
        <a href="/admin/campaigns" className="admin-card">
          <h3>Campaigns</h3>
          <span className="meta">Write and send email blasts</span>
        </a>
      </div>
    </>
  );
}
