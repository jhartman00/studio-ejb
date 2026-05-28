import type { Metadata } from "next";
import { getGalleryItems, getPageSections, pickSection } from "@/lib/db/queries";
import GalleryGrid from "./GalleryGrid";

export const metadata: Metadata = {
  title: "Gallery — Studio EJB",
  description:
    "Browse the Studio EJB gallery — ceramics, art, and small jewelry handmade in the studio.",
  alternates: {
    canonical: "/gallery",
  },
  openGraph: {
    title: "Gallery — Studio EJB",
    description:
      "Browse the Studio EJB gallery — ceramics, art, and small jewelry handmade in the studio.",
    url: "/gallery",
    type: "website",
  },
};

export default async function GalleryPage() {
  let items: Awaited<ReturnType<typeof getGalleryItems>> = [];
  let sections: Awaited<ReturnType<typeof getPageSections>> = [];
  try {
    [items, sections] = await Promise.all([
      getGalleryItems(),
      getPageSections("gallery"),
    ]);
  } catch {
    // DB unavailable: still render the page chrome.
  }
  const intro = pickSection<"gallery:intro">(sections, "gallery", "intro");

  return (
    <>
      <section className="hero">
        {intro.data.title ? (
          <h1 className="hero-headline">{intro.data.title}</h1>
        ) : (
          <h1 className="hero-headline">Gallery</h1>
        )}
        {intro.data.body ? <p className="hero-subhead">{intro.data.body}</p> : null}
      </section>
      <GalleryGrid items={items} />
    </>
  );
}
