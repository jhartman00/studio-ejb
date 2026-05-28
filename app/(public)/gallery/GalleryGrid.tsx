"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { GalleryItem } from "@/lib/db/queries";
import SafeImage from "@/components/SafeImage";

type Tag = "all" | "ceramics" | "art" | "necklaces";
const TAGS: { id: Tag; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ceramics", label: "Ceramics" },
  { id: "art", label: "Art" },
  { id: "necklaces", label: "Necklaces" },
];

export default function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const [activeTag, setActiveTag] = useState<Tag>("all");
  const [focusItem, setFocusItem] = useState<GalleryItem | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tag");
    if (t === "ceramics" || t === "art" || t === "necklaces" || t === "all") {
      setActiveTag(t);
    }
    const focusSlug = params.get("focus");
    if (focusSlug) {
      const it = items.find((i) => i.slug === focusSlug);
      if (it) setFocusItem(it);
    }
  }, [items]);

  function setTag(t: Tag) {
    setActiveTag(t);
    const url = new URL(window.location.href);
    if (t === "all") url.searchParams.delete("tag");
    else url.searchParams.set("tag", t);
    url.searchParams.delete("focus");
    window.history.replaceState({}, "", url.toString());
  }

  function openItem(item: GalleryItem) {
    setFocusItem(item);
    const url = new URL(window.location.href);
    url.searchParams.set("focus", item.slug);
    window.history.replaceState({}, "", url.toString());
  }

  function closeItem() {
    setFocusItem(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("focus");
    window.history.replaceState({}, "", url.toString());
  }

  const filtered =
    activeTag === "all" ? items : items.filter((i) => i.tag === activeTag);

  return (
    <section className="section">
      <div className="gallery-chips" role="group" aria-label="Filter gallery">
        {TAGS.map((t) => (
          <button
            type="button"
            key={t.id}
            className={`chip${activeTag === t.id ? " is-active" : ""}`}
            aria-pressed={activeTag === t.id}
            onClick={() => setTag(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>New work coming soon.</p>
        </div>
      ) : (
        <div className="gallery-grid">
          {filtered.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              className="tile"
              onClick={() => openItem(item)}
              aria-label={`View ${item.title}`}
            >
              <SafeImage
                src={item.image_url}
                alt={item.image_alt || item.title}
                width={item.image_width}
                height={item.image_height}
                sizes="(max-width: 768px) 50vw, 33vw"
                priority={idx < 3}
              />
              <span className="tile-caption">{item.title}</span>
            </button>
          ))}
        </div>
      )}

      {focusItem ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="gallery-focus-title"
          className="gallery-modal"
          onClick={closeItem}
        >
          <div
            className="gallery-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="gallery-modal-close"
              onClick={closeItem}
              aria-label="Close"
            >
              ×
            </button>
            <SafeImage
              src={focusItem.image_url}
              alt={focusItem.image_alt || focusItem.title}
              width={focusItem.image_width}
              height={focusItem.image_height}
              sizes="(max-width: 800px) 100vw, 700px"
              priority
            />
            <h2 id="gallery-focus-title">{focusItem.title}</h2>
            {focusItem.description ? <p>{focusItem.description}</p> : null}
            {focusItem.price_note ? (
              <p className="muted">{focusItem.price_note}</p>
            ) : null}
            <p>
              <Link
                href={`/contact?ref=${encodeURIComponent(focusItem.slug)}`}
              >
                Ask about this piece
              </Link>
            </p>
          </div>
        </div>
      ) : null}

    </section>
  );
}
