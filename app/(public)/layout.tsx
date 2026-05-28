import "../../styles/public.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { getPublishedTestimonials } from "@/lib/db/queries";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let showReviews = false;
  try {
    const reviews = await getPublishedTestimonials();
    showReviews = reviews.length > 0;
  } catch {
    showReviews = false;
  }
  return (
    <div className="site-shell">
      <Nav showReviews={showReviews} />
      <main className="container">{children}</main>
      <Footer />
    </div>
  );
}
