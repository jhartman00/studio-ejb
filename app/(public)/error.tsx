"use client";

import { useEffect } from "react";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[public error boundary]", error);
  }, [error]);

  return (
    <section className="hero">
      <h1 className="hero-headline">Something went sideways</h1>
      <p className="hero-subhead">
        The page hit a snag. This is on us, not on you. Try refreshing.
      </p>
      <button type="button" className="hero-cta" onClick={() => reset()}>
        Try again
      </button>
    </section>
  );
}
