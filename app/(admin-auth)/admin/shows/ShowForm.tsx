"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  showUpsertAction,
  type ShowUpsertInput,
} from "@/app/actions/shows";
import type { TradeShow } from "@/lib/db/queries";

function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ShowForm({ initial }: { initial?: TradeShow }) {
  const [form, setForm] = useState<ShowUpsertInput>({
    id: initial?.id ?? null,
    name: initial?.name ?? "",
    city: initial?.city ?? "",
    venue: initial?.venue ?? "",
    booth: initial?.booth ?? "",
    starts_at: initial?.starts_at ?? "",
    ends_at: initial?.ends_at ?? "",
    url: initial?.url ?? "",
    notes: initial?.notes ?? "",
    is_published: initial?.is_published ?? true,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function patch<K extends keyof ShowUpsertInput>(k: K, v: ShowUpsertInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function save() {
    setError(null);
    start(async () => {
      const startsIso = form.starts_at ? new Date(form.starts_at).toISOString() : "";
      const endsIso = form.ends_at ? new Date(form.ends_at).toISOString() : "";
      const res = await showUpsertAction({
        ...form,
        starts_at: startsIso,
        ends_at: endsIso,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/admin/shows");
      router.refresh();
    });
  }

  return (
    <div className="editor-shell">
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      <div className="field">
        <label htmlFor="s-name">Show name</label>
        <input
          id="s-name"
          type="text"
          value={form.name}
          onChange={(e) => patch("name", e.target.value)}
          required
        />
      </div>
      <div className="fields-grid fields-grid-2">
        <div className="field">
          <label htmlFor="s-city">City</label>
          <input
            id="s-city"
            type="text"
            value={form.city ?? ""}
            onChange={(e) => patch("city", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="s-venue">Venue</label>
          <input
            id="s-venue"
            type="text"
            value={form.venue ?? ""}
            onChange={(e) => patch("venue", e.target.value)}
          />
        </div>
      </div>
      <div className="fields-grid fields-grid-2">
        <div className="field">
          <label htmlFor="s-starts">Starts at</label>
          <input
            id="s-starts"
            type="datetime-local"
            value={toLocalInput(form.starts_at)}
            onChange={(e) => patch("starts_at", e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="s-ends">Ends at</label>
          <input
            id="s-ends"
            type="datetime-local"
            value={toLocalInput(form.ends_at)}
            onChange={(e) => patch("ends_at", e.target.value)}
            required
          />
        </div>
      </div>
      <div className="fields-grid fields-grid-2">
        <div className="field">
          <label htmlFor="s-booth">Booth</label>
          <input
            id="s-booth"
            type="text"
            value={form.booth ?? ""}
            onChange={(e) => patch("booth", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="s-url">URL (optional)</label>
          <input
            id="s-url"
            type="text"
            value={form.url ?? ""}
            onChange={(e) => patch("url", e.target.value)}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="s-notes">Notes</label>
        <textarea
          id="s-notes"
          value={form.notes ?? ""}
          onChange={(e) => patch("notes", e.target.value)}
        />
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
          disabled={pending || !form.name || !form.starts_at || !form.ends_at}
        >
          {pending ? "Saving..." : "Save"}
        </button>
        <a href="/admin/shows" className="btn btn-danger">Cancel</a>
      </div>
    </div>
  );
}
