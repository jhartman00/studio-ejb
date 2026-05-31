import "../../styles/public.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="site-shell">
      <Nav />
      <main className="container">{children}</main>
      <Footer />
    </div>
  );
}
