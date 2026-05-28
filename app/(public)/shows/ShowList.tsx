"use client";

import { useState } from "react";
import type { TradeShow } from "@/lib/db/queries";

function fmtRange(startsAt: string, endsAt: string): string {
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

function ShowCard({ show }: { show: TradeShow }) {
  return (
    <li className="show-card">
      <span className="date">{fmtRange(show.starts_at, show.ends_at)}</span>
      <strong>{show.name}</strong>
      {show.venue || show.city ? (
        <p className="where">
          {[show.venue, show.city].filter(Boolean).join(", ")}
          {show.booth ? ` · Booth ${show.booth}` : ""}
        </p>
      ) : null}
      {show.notes ? <p className="notes">{show.notes}</p> : null}
      {show.url ? (
        <p>
          <a href={show.url} target="_blank" rel="noopener">
            Show details
          </a>
        </p>
      ) : null}
    </li>
  );
}

export default function ShowList({
  upcoming,
  past,
}: {
  upcoming: TradeShow[];
  past: TradeShow[];
}) {
  const [showPast, setShowPast] = useState(false);

  if (upcoming.length === 0) {
    return (
      <section className="section">
        <div className="empty-state">
          <p>No shows on the calendar right now. Check back soon.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <h2>Upcoming</h2>
      <ul className="show-list">
        {upcoming.map((s) => (
          <ShowCard key={s.id} show={s} />
        ))}
      </ul>

      {past.length > 0 ? (
        <>
          <button
            type="button"
            className="collapse-toggle"
            onClick={() => setShowPast((p) => !p)}
            aria-expanded={showPast}
          >
            {showPast ? "Hide past shows" : `Past shows (${past.length})`}
          </button>
          {showPast ? (
            <ul className="show-list">
              {past.map((s) => (
                <ShowCard key={s.id} show={s} />
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
