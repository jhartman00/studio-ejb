import "../../styles/admin.css";
import { logoutAction } from "@/app/actions/auth";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-shell">
      <header className="admin-top">
        <a href="/admin" className="admin-brand">
          Studio EJB admin
        </a>
        <nav className="admin-top-links">
          <a href="/" target="_blank" rel="noopener">
            View site
          </a>
          <form action={logoutAction}>
            <button type="submit" className="btn">
              Sign out
            </button>
          </form>
        </nav>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
