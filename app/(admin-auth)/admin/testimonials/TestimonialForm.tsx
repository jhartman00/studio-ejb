"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  testimonialUpsertAction,
  type TestimonialUpsertInput,
} from "@/app/actions/testimonials";
import type { Testimonial } from "@/lib/db/queries";

export default function TestimonialForm({ initial }: { initial?: Testimonial }) {
  const [form, setForm] = useState<TestimonialUpsertInput>({
    id: initial?.id ?? null,
    quote: initial?.quote ?? "",
    attribution: initial?.attribution ?? "",
    location: initial?.location ?? "",
    source_label: initial?.source_label ?? "",
    display_order: initial?.display_order ?? 0,
    is_published: initial?.is_published ?? true,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function patch<K extends keyof TestimonialUpsertInput>(
    k: K,
    v: TestimonialUpsertInput[K],
  ) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await testimonialUpsertAction(form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/admin/testimonials");
      router.refresh();
    });
  }

  return (
    <div className="editor-shell">
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      <div className="field">
        <label htmlFor="t-quote">Quote</label>
        <textarea
          id="t-quote"
          value={form.quote}
          onChange={(e) => patch("quote", e.target.value)}
          required
        />
      </div>
      <div className="fields-grid fields-grid-2">
        <div className="field">
          <label htmlFor="t-attr">Attribution</label>
          <input
            id="t-attr"
            type="text"
            value={form.attribution}
            onChange={(e) => patch("attribution", e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="t-loc">Location (optional)</label>
          <input
            id="t-loc"
            type="text"
            value={form.location ?? ""}
            onChange={(e) => patch("location", e.target.value)}
          />
        </div>
      </div>
      <div className="fields-grid fields-grid-2">
        <div className="field">
          <label htmlFor="t-src">Source (e.g. "Etsy", optional)</label>
          <input
            id="t-src"
            type="text"
            value={form.source_label ?? ""}
            onChange={(e) => patch("source_label", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="t-order">Display order</label>
          <input
            id="t-order"
            type="number"
            value={form.display_order ?? 0}
            onChange={(e) => patch("display_order", Number(e.target.value))}
          />
        </div>
      </div>
      <div className="field">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={Boolean(form.is_published)}
            onChange={(e) => patch("is_published", e.target.checked)}
          />
          Show on public site
        </label>
      </div>
      <div style={{ display: "flex", gap: "var(--s-12)" }}>
        <button
          type="button"
          className="btn"
          onClick={save}
          disabled={pending || !form.quote || !form.attribution}
        >
          {pending ? "Saving..." : "Save"}
        </button>
        <a href="/admin/testimonials" className="btn btn-danger">Cancel</a>
      </div>
    </div>
  );
}
