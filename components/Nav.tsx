import Link from "next/link";

// Pure-CSS mobile drawer: hidden checkbox + adjacent-sibling combinator.
// No JS needed on the public site.

export default function Nav({
  showReviews = true,
}: {
  showReviews?: boolean;
}) {
  return (
    <nav className="nav" aria-label="Primary">
      <input id="nav-toggle" type="checkbox" aria-hidden="true" />
      <div className="nav-inner">
        <Link href="/" className="nav-brand">
          Studio EJB
        </Link>
        <div className="nav-links">
          <Link href="/gallery">Gallery</Link>
          <Link href="/about">About</Link>
          <Link href="/shows">Shows</Link>
          {showReviews ? <Link href="/reviews">Reviews</Link> : null}
          <Link href="/contact">Contact</Link>
        </div>
        <label htmlFor="nav-toggle" className="nav-toggle" aria-label="Open menu">
          <span aria-hidden="true">☰</span>
        </label>
      </div>
      <div className="nav-mobile" role="region" aria-label="Menu">
        <Link href="/gallery">Gallery</Link>
        <Link href="/about">About</Link>
        <Link href="/shows">Shows</Link>
        {showReviews ? <Link href="/reviews">Reviews</Link> : null}
        <Link href="/contact">Contact</Link>
      </div>
    </nav>
  );
}
