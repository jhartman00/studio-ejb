import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <section className="hero">
        <h1 className="hero-headline">Not here</h1>
        <p className="hero-subhead">
          This page does not exist, or the link you followed is from an older
          version of the site. Try one of these:
        </p>
        <div style={{ display: "flex", gap: "var(--s-12)", flexWrap: "wrap" }}>
          <Link href="/" className="hero-cta">
            Go home
          </Link>
          <Link
            href="/gallery"
            className="hero-cta"
            style={{
              background: "var(--cream-100)",
              borderColor: "var(--ink-900)",
            }}
          >
            See the gallery
          </Link>
        </div>
      </section>
    </>
  );
}
