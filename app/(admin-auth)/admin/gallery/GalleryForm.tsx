"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ImageUploader from "@/components/ImageUploader";
import {
  galleryUpsertAction,
  type GalleryUpsertInput,
} from "@/app/actions/gallery";
import type { GalleryItem } from "@/lib/db/queries";
import { slugify } from "@/lib/slug";
import { titleFromFilename } from "@/lib/title-from-filename";
import { CATEGORY_VALUES, CATEGORY_LABELS } from "@/lib/content/categories";

type Form = GalleryUpsertInput;

export default function GalleryForm({ initial }: { initial?: GalleryItem }) {
  const [form, setForm] = useState<Form>({
    id: initial?.id ?? null,
    slug: initial?.slug ?? "",
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    tag: initial?.tag ?? "ceramics",
    image_url: initial?.image_url ?? "",
    image_alt: initial?.image_alt ?? "",
    image_width: initial?.image_width ?? null,
    image_height: initial?.image_height ?? null,
    price_note: initial?.price_note ?? "",
    display_order: initial?.display_order ?? 0,
    is_featured: initial?.is_featured ?? false,
    show_description: initial?.show_description ?? true,
    show_price: initial?.show_price ?? true,
    original_filename: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function patch<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function onImageChange(v: {
    url: string;
    width: number | null;
    height: number | null;
    filename?: string;
  }) {
    setForm((f) => {
      const next: Form = {
        ...f,
        image_url: v.url,
        image_width: v.width,
        image_height: v.height,
      };
      if (v.filename) {
        next.original_filename = v.filename;
        if (!f.title || f.title.trim().length === 0) {
          const derived = titleFromFilename(v.filename);
          if (derived && derived !== "Untitled") next.title = derived;
        }
      }
      return next;
    });
  }

  function save() {
    setError(null);
    start(async () => {
      // Send an empty slug on new items so the server derives + dedupes.
      const payload: Form = form.id
        ? form
        : { ...form, slug: "" };
      const res = await galleryUpsertAction(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/admin/gallery");
      router.refresh();
    });
  }

  // Only show a URL preview once the user has typed a title or uploaded a
  // file. Otherwise it would default to "untitled" and be misleading.
  const slugPreview = form.id
    ? form.slug
    : form.title || form.original_filename
      ? slugify(form.title || titleFromFilename(form.original_filename ?? ""))
      : "";

  return (
    <div className="editor-shell">
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      <div className="field">
        <label htmlFor="g-title">Title</label>
        <input
          id="g-title"
          type="text"
          value={form.title ?? ""}
          onChange={(e) => patch("title", e.target.value)}
          placeholder="Leave blank to use the filename"
        />
        {slugPreview ? (
          <div className="field-hint">
            URL: <code>/gallery?focus={slugPreview}</code>
          </div>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor="g-tag">Category</label>
        <select
          id="g-tag"
          value={form.tag}
          onChange={(e) => patch("tag", e.target.value as Form["tag"])}
        >
          {CATEGORY_VALUES.map((value) => (
            <option key={value} value={value}>
              {CATEGORY_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="g-desc">Description</label>
        <textarea
          id="g-desc"
          value={form.description ?? ""}
          onChange={(e) => patch("description", e.target.value)}
        />
        <label className="checkbox-row" style={{ marginTop: "var(--s-8)" }}>
          <input
            type="checkbox"
            checked={form.show_description ?? true}
            onChange={(e) => patch("show_description", e.target.checked)}
          />
          Show description on public site
        </label>
      </div>
      <div className="field">
        <label>Image</label>
        <ImageUploader
          area="gallery"
          value={form.image_url}
          onChange={onImageChange}
        />
      </div>
      <div className="field">
        <label htmlFor="g-alt">Image alt text</label>
        <input
          id="g-alt"
          type="text"
          value={form.image_alt ?? ""}
          onChange={(e) => patch("image_alt", e.target.value)}
          placeholder="Defaults to title"
        />
        <div className="field-hint">
          Leave blank to use the title.
        </div>
      </div>
      <div className="field">
        <label htmlFor="g-price">Price note (optional)</label>
        <input
          id="g-price"
          type="text"
          value={form.price_note ?? ""}
          onChange={(e) => patch("price_note", e.target.value)}
        />
        <label className="checkbox-row" style={{ marginTop: "var(--s-8)" }}>
          <input
            type="checkbox"
            checked={form.show_price ?? true}
            onChange={(e) => patch("show_price", e.target.checked)}
          />
          Show price on public site
        </label>
      </div>
      <div className="fields-grid fields-grid-2">
        <div className="field">
          <label htmlFor="g-order">Display order</label>
          <input
            id="g-order"
            type="number"
            value={form.display_order ?? 0}
            onChange={(e) => patch("display_order", Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={Boolean(form.is_featured)}
              onChange={(e) => patch("is_featured", e.target.checked)}
            />
            Feature on home page
          </label>
        </div>
      </div>
      <div style={{ display: "flex", gap: "var(--s-12)" }}>
        <button
          type="button"
          className="btn"
          onClick={save}
          disabled={pending || !form.image_url}
        >
          {pending ? "Saving..." : "Save"}
        </button>
        <a href="/admin/gallery" className="btn btn-danger">
          Cancel
        </a>
      </div>
    </div>
  );
}
