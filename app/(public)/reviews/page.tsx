import { getPageSections, getPublishedTestimonials, pickSection } from "@/lib/db/queries";
import { notFound } from "next/navigation";

export default async function ReviewsPage() {
  let reviews: Awaited<ReturnType<typeof getPublishedTestimonials>> = [];
  let sections: Awaited<ReturnType<typeof getPageSections>> = [];
  try {
    [reviews, sections] = await Promise.all([
      getPublishedTestimonials(),
      getPageSections("reviews"),
    ]);
  } catch {
    // ignore
  }
  const intro = pickSection<"reviews:intro">(sections, "reviews", "intro");

  if (reviews.length === 0) {
    notFound();
  }

  return (
    <>
      <section className="hero">
        <h1 className="hero-headline">{intro.data.title || "Kind words"}</h1>
        {intro.data.body ? (
          <p className="hero-subhead">{intro.data.body}</p>
        ) : null}
      </section>

      <section className="section">
        <div className="review-grid">
          {reviews.map((r) => (
            <article key={r.id} className="review-card">
              <blockquote>{r.quote}</blockquote>
              <cite>
                {r.attribution}
                {r.location ? ` · ${r.location}` : ""}
                {r.source_label ? ` · ${r.source_label}` : ""}
              </cite>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
