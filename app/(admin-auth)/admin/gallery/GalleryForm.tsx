"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ImageUploader from "@/components/ImageUploader";
import {
  galleryUpsertAction,
  type GalleryUpsertInput,
} from "@/app/actions/gallery";
import type { GalleryItem } from "@/lib/db/queries";

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
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function patch<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await galleryUpsertAction(form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/admin/gallery");
      router.refresh();
    });
  }

  return (
    <div className="editor-shell">
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      <div className="fields-grid fields-grid-2">
        <div className="field">
          <label htmlFor="g-title">Title</label>
          <input
            id="g-title"
            type="text"
            value={form.title}
            onChange={(e) => patch("title", e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="g-slug">Slug (URL-friendly)</label>
          <input
            id="g-slug"
            type="text"
            value={form.slug}
            onChange={(e) =>
              patch("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
            }
            required
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="g-tag">Category</label>
        <select
          id="g-tag"
          value={form.tag}
          onChange={(e) => patch("tag", e.target.value as Form["tag"])}
        >
          <option value="ceramics">Ceramics</option>
          <option value="art">Art</option>
          <option value="necklaces">Necklaces</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="g-desc">Description</label>
        <textarea
          id="g-desc"
          value={form.description ?? ""}
          onChange={(e) => patch("description", e.target.value)}
        />
      </div>
      <div className="field">
        <label>Image</label>
        <ImageUploader
          area="gallery"
          value={form.image_url}
          onChange={(v) => {
            patch("image_url", v.url);
            patch("image_width", v.width);
            patch("image_height", v.height);
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="g-alt">Image alt text</label>
        <input
          id="g-alt"
          type="text"
          value={form.image_alt ?? ""}
          onChange={(e) => patch("image_alt", e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="g-price">Price note (optional)</label>
        <input
          id="g-price"
          type="text"
          value={form.price_note ?? ""}
          onChange={(e) => patch("price_note", e.target.value)}
        />
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
