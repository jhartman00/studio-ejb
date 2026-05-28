import {
  getPageSections,
  getGalleryItems,
  getNextUpcomingShow,
  pickSection,
} from "@/lib/db/queries";
import { sanitizeHtml } from "@/lib/sanitize";
import SafeImage from "@/components/SafeImage";
import SubscribeForm from "@/components/SubscribeForm";
import Link from "next/link";

export default async function HomePage() {
  let sections: Awaited<ReturnType<typeof getPageSections>> = [];
  let gallery: Awaited<ReturnType<typeof getGalleryItems>> = [];
  let nextShow: Awaited<ReturnType<typeof getNextUpcomingShow>> = null;
  let dbError = false;

  try {
    [sections, gallery, nextShow] = await Promise.all([
      getPageSections("home"),
      getGalleryItems(),
      getNextUpcomingShow(),
    ]);
  } catch {
    dbError = true;
  }

  if (dbError) {
    return (
      <section className="hero">
        <h1>Studio EJB</h1>
        <p className="muted">Site is being set up. Check back soon.</p>
      </section>
    );
  }

  const ordered = [...sections]
    .filter((s) => s.enabled)
    .sort((a, b) => a.sort_order - b.sort_order);

  const hero = pickSection<"home:hero">(sections, "home", "hero");
  const featured = pickSection<"home:featured">(sections, "home", "featured");
  const studioNote = pickSection<"home:studio_note">(sections, "home", "studio_note");
  const newsletter = pickSection<"home:newsletter">(sections, "home", "newsletter");

  const featuredItems = featured.data.gallery_item_ids
    .map((id) => gallery.find((g) => g.id === id))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));
  const fallbackFeatured = gallery.filter((g) => g.is_featured).slice(0, 3);
  const featuredToShow = featuredItems.length > 0 ? featuredItems : fallbackFeatured;

  return (
    <>
      {hero.row?.enabled !== false ? (
        <section className="hero">
          {hero.data.headline ? (
            <h1 className="hero-headline">{hero.data.headline}</h1>
          ) : null}
          {hero.data.subhead ? (
            <p className="hero-subhead">{hero.data.subhead}</p>
          ) : null}
          {hero.data.cta_label && hero.data.cta_href ? (
            <Link href={hero.data.cta_href} className="hero-cta">
              {hero.data.cta_label}
            </Link>
          ) : null}
          {hero.data.image_url ? (
            <div className="hero-image">
              <SafeImage
                src={hero.data.image_url}
                alt={hero.data.image_alt || ""}
                width={hero.data.image_width ?? 1600}
                height={hero.data.image_height ?? 1000}
                sizes="100vw"
                priority
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {ordered.map((s) => {
        if (s.section === "hero") return null;
        if (s.section === "featured") {
          if (featuredToShow.length === 0) return null;
          return (
            <section className="section" key={s.id}>
              <h2>Selected work</h2>
              <div className="featured-grid">
                {featuredToShow.map((item) => (
                  <Link
                    href={`/gallery?focus=${encodeURIComponent(item.slug)}`}
                    key={item.id}
                    className="tile"
                  >
                    <SafeImage
                      src={item.image_url}
                      alt={item.image_alt || item.title}
                      width={item.image_width}
                      height={item.image_height}
                      sizes="(max-width: 600px) 100vw, 33vw"
                    />
                    <span className="tile-caption">{item.title}</span>
                  </Link>
                ))}
              </div>
            </section>
          );
        }
        if (s.section === "studio_note") {
          if (!studioNote.data.title && !studioNote.data.body_html) return null;
          return (
            <section className="section" key={s.id}>
              {studioNote.data.title ? <h2>{studioNote.data.title}</h2> : null}
              <div
                className="prose"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(studioNote.data.body_html),
                }}
              />
            </section>
          );
        }
        if (s.section === "newsletter") {
          if (!newsletter.data.title && !newsletter.data.body) return null;
          return (
            <section className="section" key={s.id}>
              {newsletter.data.title ? <h2>{newsletter.data.title}</h2> : null}
              {newsletter.data.body ? <p>{newsletter.data.body}</p> : null}
              <SubscribeForm source="home" />
            </section>
          );
        }
        return null;
      })}

      {nextShow ? (
        <section className="section" aria-label="Upcoming show">
          <h2>Next show</h2>
          <article className="show-card">
            <span className="date">
              {formatShowDate(nextShow.starts_at, nextShow.ends_at)}
            </span>
            <strong>{nextShow.name}</strong>
            {nextShow.venue || nextShow.city ? (
              <p className="where">
                {[nextShow.venue, nextShow.city].filter(Boolean).join(", ")}
                {nextShow.booth ? ` · Booth ${nextShow.booth}` : ""}
              </p>
            ) : null}
            {nextShow.notes ? <p className="notes">{nextShow.notes}</p> : null}
            {nextShow.url ? (
              <p>
                <a href={nextShow.url} target="_blank" rel="noopener">
                  Show details
                </a>
              </p>
            ) : null}
          </article>
        </section>
      ) : null}
    </>
  );
}

function formatShowDate(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();
  const opt: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  if (sameDay) return s.toLocaleDateString("en-US", opt);
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} to ${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${s.toLocaleDateString("en-US", opt)} to ${e.toLocaleDateString("en-US", opt)}`;
}
