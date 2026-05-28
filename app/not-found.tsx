import "../styles/public.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Link from "next/link";

// Root-level not-found page. Renders for routes outside any segment's
// notFound() (e.g. /asdf). Mirrors the public chrome.

export default function RootNotFound() {
  return (
    <div className="site-shell">
      <Nav />
      <main className="container">
        <section className="hero">
          <h1 className="hero-headline">Not here</h1>
          <p className="hero-subhead">
            This page does not exist. Try one of these:
          </p>
          <div style={{ display: "flex", gap: "var(--s-12)", flexWrap: "wrap" }}>
            <Link href="/" className="hero-cta">Go home</Link>
            <Link
              href="/gallery"
              className="hero-cta"
              style={{ background: "var(--cream-100)" }}
            >
              See the gallery
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
