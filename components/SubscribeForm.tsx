"use client";

import { useActionState } from "react";
import { subscribeAction, type SubscribeState } from "@/app/actions/public-forms";

const initial: SubscribeState = {};

export default function SubscribeForm({ source }: { source?: string }) {
  const [state, formAction, pending] = useActionState(subscribeAction, initial);

  if (state.done) {
    return (
      <p role="status" className="muted">
        Thanks. A few emails a year, that's it.
      </p>
    );
  }

  return (
    <form className="form" action={formAction}>
      {state.error ? (
        <div className="form-error" role="alert">
          {state.error}
        </div>
      ) : null}
      <input type="hidden" name="source" value={source ?? ""} />
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="sub-website-hp">Website</label>
        <input
          id="sub-website-hp"
          name="website"
          type="text"
          autoComplete="off"
          tabIndex={-1}
        />
      </div>
      <div style={{ display: "flex", gap: "var(--s-8)" }}>
        <input
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          maxLength={254}
          className="input"
          style={{ flex: 1 }}
        />
        <button
          type="submit"
          className="hero-cta"
          disabled={pending}
          aria-disabled={pending}
        >
          {pending ? "..." : "Subscribe"}
        </button>
      </div>
    </form>
  );
}
