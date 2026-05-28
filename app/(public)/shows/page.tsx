import { getPageSections, getPublishedShows, pickSection } from "@/lib/db/queries";
import ShowList from "./ShowList";

export default async function ShowsPage() {
  let shows: Awaited<ReturnType<typeof getPublishedShows>> = [];
  let sections: Awaited<ReturnType<typeof getPageSections>> = [];
  try {
    [shows, sections] = await Promise.all([
      getPublishedShows(),
      getPageSections("shows"),
    ]);
  } catch {
    // ignore
  }
  const intro = pickSection<"shows:intro">(sections, "shows", "intro");

  const now = new Date();
  const upcoming = shows.filter((s) => new Date(s.ends_at) >= now);
  const past = shows
    .filter((s) => new Date(s.ends_at) < now)
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

  return (
    <>
      <section className="hero">
        <h1 className="hero-headline">{intro.data.title || "Where to find me"}</h1>
        {intro.data.body ? (
          <p className="hero-subhead">{intro.data.body}</p>
        ) : null}
      </section>
      <ShowList upcoming={upcoming} past={past} />
    </>
  );
}
