"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import RichText from "@/components/RichText";
import ImageUploader from "@/components/ImageUploader";
import { saveSectionAction, toggleSectionAction } from "@/app/actions/content";

type SectionRow = {
  page: string;
  section: string;
  data: unknown;
  enabled: boolean;
  sort_order: number;
};

type GalleryStub = { id: number; title: string; slug: string };

const SECTION_LABELS: Record<string, string> = {
  hero: "Hero",
  featured: "Featured work",
  studio_note: "Studio note",
  newsletter: "Newsletter signup",
  intro: "Intro",
  find_me_at: "Find me at",
  methods: "Contact methods",
};

function labelFor(section: string): string {
  return SECTION_LABELS[section] ?? section;
}

export default function PageEditor({
  pageSlug,
  sections,
  galleryItems,
}: {
  pageSlug: string;
  sections: SectionRow[];
  galleryItems: GalleryStub[];
}) {
  const ordered = useMemo(
    () => [...sections].sort((a, b) => a.sort_order - b.sort_order || a.section.localeCompare(b.section)),
    [sections],
  );

  const [rows, setRows] = useState(ordered);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const anyDirty = Object.values(dirty).some(Boolean);

  useEffect(() => {
    function before(e: BeforeUnloadEvent) {
      if (!anyDirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [anyDirty]);

  function patchRow(section: string, patch: Partial<SectionRow>) {
    setRows((prev) =>
      prev.map((r) =>
        r.section === section
          ? { ...r, ...patch, data: patch.data !== undefined ? patch.data : r.data }
          : r,
      ),
    );
    setDirty((d) => ({ ...d, [section]: true }));
  }

  function patchData(section: string, mut: (d: Record<string, unknown>) => Record<string, unknown>) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.section !== section) return r;
        const cur = (r.data as Record<string, unknown>) ?? {};
        return { ...r, data: mut(cur) };
      }),
    );
    setDirty((d) => ({ ...d, [section]: true }));
  }

  async function saveAll() {
    setBannerError(null);
    startTransition(async () => {
      for (const r of rows) {
        if (!dirty[r.section]) continue;
        const res = await saveSectionAction({
          page: r.page,
          section: r.section,
          data: r.data,
          enabled: r.enabled,
          sort_order: r.sort_order,
        });
        if (!res.ok) {
          setBannerError(`Could not save "${labelFor(r.section)}": ${res.error}`);
          return;
        }
      }
      setDirty({});
      setSavedAt(new Date().toLocaleTimeString());
    });
  }

  function discard() {
    if (!window.confirm("Discard all unsaved changes on this page?")) return;
    setRows(ordered);
    setDirty({});
  }

  async function toggleEnabled(section: string, enabled: boolean) {
    patchRow(section, { enabled });
    const res = await toggleSectionAction({
      page: pageSlug,
      section,
      enabled,
    });
    if (!res.ok) {
      setBannerError(`Could not toggle visibility: ${res.error}`);
      patchRow(section, { enabled: !enabled });
    }
  }

  async function reorder(section: string, direction: "up" | "down") {
    const idx = rows.findIndex((r) => r.section === section);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= rows.length) return;
    const next = [...rows];
    const a = next[idx]!;
    const b = next[swapIdx]!;
    next[idx] = b;
    next[swapIdx] = a;
    const renumbered = next.map((r, i) => ({ ...r, sort_order: i }));
    setRows(renumbered);
    // Persist both rows' new sort_order.
    const aRes = await toggleSectionAction({
      page: pageSlug,
      section: a.section,
      sort_order: renumbered.find((r) => r.section === a.section)!.sort_order,
    });
    const bRes = await toggleSectionAction({
      page: pageSlug,
      section: b.section,
      sort_order: renumbered.find((r) => r.section === b.section)!.sort_order,
    });
    if (!aRes.ok || !bRes.ok) {
      setBannerError("Could not save new order");
    }
  }

  return (
    <div className="editor-shell">
      <div className="section-header">
        <h1 style={{ margin: 0 }}>
          Edit page: {pageSlug}
        </h1>
        <a
          href={pageSlug === "home" ? "/" : `/${pageSlug}`}
          target="_blank"
          rel="noopener"
        >
          View public page
        </a>
      </div>

      {bannerError ? (
        <div className="form-error" role="alert">{bannerError}</div>
      ) : null}
      {savedAt && !anyDirty ? (
        <div
          style={{
            background: "var(--cream-100)",
            padding: "var(--s-12)",
            borderRadius: "var(--radius-card)",
            color: "var(--ink-600)",
            fontSize: "var(--fs-14)",
          }}
          role="status"
        >
          Saved at {savedAt}.
        </div>
      ) : null}

      <div className="editor-toc" aria-label="Section index">
        {rows.map((r) => (
          <a key={r.section} href={`#section-${r.section}`}>
            {labelFor(r.section)}{" "}
            <span className="hidden-marker">
              ({r.enabled ? "visible" : "hidden"})
            </span>
          </a>
        ))}
      </div>

      {rows.map((r, i) => (
        <div
          key={r.section}
          id={`section-${r.section}`}
          className="section-card"
        >
          <div className="section-card-head">
            <h3>{labelFor(r.section)}</h3>
            <div className="section-card-actions">
              <button
                type="button"
                className="icon-btn"
                aria-label="Move up"
                disabled={i === 0}
                onClick={() => reorder(r.section, "up")}
              >
                ↑
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Move down"
                disabled={i === rows.length - 1}
                onClick={() => reorder(r.section, "down")}
              >
                ↓
              </button>
              <button
                type="button"
                className="pill"
                aria-pressed={r.enabled}
                onClick={() => toggleEnabled(r.section, !r.enabled)}
              >
                {r.enabled ? "Visible" : "Hidden"}
              </button>
            </div>
          </div>
          <SectionFields
            page={pageSlug}
            section={r.section}
            data={r.data}
            galleryItems={galleryItems}
            onPatch={(mut) => patchData(r.section, mut)}
          />
        </div>
      ))}

      {anyDirty ? (
        <div className="dirty-bar" role="region" aria-label="Unsaved changes">
          <span>You have unsaved changes.</span>
          <div style={{ display: "flex", gap: "var(--s-8)" }}>
            <button
              type="button"
              className="btn btn-danger"
              onClick={discard}
              disabled={pending}
            >
              Discard
            </button>
            <button
              type="button"
              className="btn"
              onClick={saveAll}
              disabled={pending}
            >
              {pending ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SectionFields({
  page,
  section,
  data,
  galleryItems,
  onPatch,
}: {
  page: string;
  section: string;
  data: unknown;
  galleryItems: GalleryStub[];
  onPatch: (mut: (d: Record<string, unknown>) => Record<string, unknown>) => void;
}) {
  const d = (data as Record<string, unknown>) ?? {};

  const setField = (k: string, v: unknown) =>
    onPatch((cur) => ({ ...cur, [k]: v }));

  if (page === "home" && section === "hero") {
    return (
      <>
        <div className="fields-grid">
          <div className="field">
            <label htmlFor="hero-headline">Headline</label>
            <input
              id="hero-headline"
              type="text"
              value={String(d.headline ?? "")}
              onChange={(e) => setField("headline", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="hero-subhead">Subhead</label>
            <textarea
              id="hero-subhead"
              value={String(d.subhead ?? "")}
              onChange={(e) => setField("subhead", e.target.value)}
            />
          </div>
          <div className="fields-grid fields-grid-2">
            <div className="field">
              <label htmlFor="hero-cta-label">Button label</label>
              <input
                id="hero-cta-label"
                type="text"
                value={String(d.cta_label ?? "")}
                onChange={(e) => setField("cta_label", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="hero-cta-href">Button link</label>
              <input
                id="hero-cta-href"
                type="text"
                value={String(d.cta_href ?? "")}
                onChange={(e) => setField("cta_href", e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label>Hero image</label>
            <ImageUploader
              area="hero"
              value={String(d.image_url ?? "")}
              onChange={(v) =>
                onPatch((cur) => ({
                  ...cur,
                  image_url: v.url,
                  image_width: v.width,
                  image_height: v.height,
                }))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="hero-alt">Image alt text</label>
            <input
              id="hero-alt"
              type="text"
              value={String(d.image_alt ?? "")}
              onChange={(e) => setField("image_alt", e.target.value)}
            />
          </div>
        </div>
      </>
    );
  }

  if (page === "home" && section === "featured") {
    const ids = (d.gallery_item_ids as number[] | undefined) ?? [];
    return (
      <div className="field">
        <label>Featured gallery items</label>
        <p className="muted" style={{ fontSize: "var(--fs-14)" }}>
          Pick up to three. Leave empty to auto-pick items marked Featured.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-8)" }}>
          {galleryItems.map((g) => {
            const checked = ids.includes(g.id);
            return (
              <label key={g.id} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...ids, g.id].slice(0, 3)
                      : ids.filter((id) => id !== g.id);
                    setField("gallery_item_ids", next);
                  }}
                />
                {g.title} <span className="muted">({g.slug})</span>
              </label>
            );
          })}
          {galleryItems.length === 0 ? (
            <p className="muted">No gallery items yet. Add some in /admin/gallery.</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (page === "home" && section === "studio_note") {
    return (
      <>
        <div className="field">
          <label htmlFor="sn-title">Title</label>
          <input
            id="sn-title"
            type="text"
            value={String(d.title ?? "")}
            onChange={(e) => setField("title", e.target.value)}
          />
        </div>
        <div className="field">
          <label>Body</label>
          <RichText
            value={String(d.body_html ?? "")}
            onChange={(html) => setField("body_html", html)}
            ariaLabel="Studio note body"
          />
        </div>
      </>
    );
  }

  if (page === "home" && section === "newsletter") {
    return (
      <>
        <div className="field">
          <label htmlFor="nl-title">Title</label>
          <input
            id="nl-title"
            type="text"
            value={String(d.title ?? "")}
            onChange={(e) => setField("title", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="nl-body">Body text</label>
          <textarea
            id="nl-body"
            value={String(d.body ?? "")}
            onChange={(e) => setField("body", e.target.value)}
          />
        </div>
      </>
    );
  }

  if (page === "about" && section === "intro") {
    return (
      <>
        <div className="field">
          <label htmlFor="about-title">Title</label>
          <input
            id="about-title"
            type="text"
            value={String(d.title ?? "")}
            onChange={(e) => setField("title", e.target.value)}
          />
        </div>
        <div className="field">
          <label>Body</label>
          <RichText
            value={String(d.body_html ?? "")}
            onChange={(html) => setField("body_html", html)}
            ariaLabel="About body"
          />
        </div>
        <div className="field">
          <label>Portrait</label>
          <ImageUploader
            area="about"
            value={String(d.portrait_url ?? "")}
            onChange={(v) =>
              onPatch((cur) => ({
                ...cur,
                portrait_url: v.url,
                portrait_width: v.width,
                portrait_height: v.height,
              }))
            }
          />
        </div>
        <div className="field">
          <label htmlFor="portrait-alt">Portrait alt text</label>
          <input
            id="portrait-alt"
            type="text"
            value={String(d.portrait_alt ?? "")}
            onChange={(e) => setField("portrait_alt", e.target.value)}
          />
        </div>
      </>
    );
  }

  if (page === "about" && section === "find_me_at") {
    const links = (d.links as Array<{ label: string; href: string }> | undefined) ?? [];
    return (
      <div className="field">
        <label>Find me at links</label>
        {links.map((link, idx) => (
          <div key={idx} className="fields-grid fields-grid-2" style={{ marginBottom: "var(--s-8)" }}>
            <div className="field">
              <input
                type="text"
                placeholder="Label"
                value={link.label}
                onChange={(e) => {
                  const next = [...links];
                  next[idx] = { ...next[idx]!, label: e.target.value };
                  setField("links", next);
                }}
              />
            </div>
            <div className="field" style={{ display: "flex", flexDirection: "row", gap: "var(--s-8)" }}>
              <input
                type="text"
                placeholder="https://..."
                value={link.href}
                onChange={(e) => {
                  const next = [...links];
                  next[idx] = { ...next[idx]!, href: e.target.value };
                  setField("links", next);
                }}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setField("links", links.filter((_, i) => i !== idx))}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn"
          onClick={() => setField("links", [...links, { label: "", href: "" }])}
        >
          Add link
        </button>
      </div>
    );
  }

  if (page === "contact" && section === "methods") {
    const methods = (d.methods as Array<{ label: string; value: string }> | undefined) ?? [];
    return (
      <div className="field">
        <label>Contact methods</label>
        {methods.map((m, idx) => (
          <div key={idx} className="fields-grid fields-grid-2" style={{ marginBottom: "var(--s-8)" }}>
            <div className="field">
              <input
                type="text"
                placeholder="Label (Venmo, Email, Instagram)"
                value={m.label}
                onChange={(e) => {
                  const next = [...methods];
                  next[idx] = { ...next[idx]!, label: e.target.value };
                  setField("methods", next);
                }}
              />
            </div>
            <div className="field" style={{ display: "flex", flexDirection: "row", gap: "var(--s-8)" }}>
              <input
                type="text"
                placeholder="Value"
                value={m.value}
                onChange={(e) => {
                  const next = [...methods];
                  next[idx] = { ...next[idx]!, value: e.target.value };
                  setField("methods", next);
                }}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setField("methods", methods.filter((_, i) => i !== idx))}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn"
          onClick={() => setField("methods", [...methods, { label: "", value: "" }])}
        >
          Add method
        </button>
      </div>
    );
  }

  // Generic intro (gallery/shows/contact intro)
  return (
    <>
      <div className="field">
        <label htmlFor={`${section}-title`}>Title</label>
        <input
          id={`${section}-title`}
          type="text"
          value={String(d.title ?? "")}
          onChange={(e) => setField("title", e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={`${section}-body`}>Body</label>
        <textarea
          id={`${section}-body`}
          value={String(d.body ?? "")}
          onChange={(e) => setField("body", e.target.value)}
        />
      </div>
    </>
  );
}
