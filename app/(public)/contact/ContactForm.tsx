"use client";

import { useActionState } from "react";
import { contactAction, type ContactState } from "@/app/actions/public-forms";

const initial: ContactState = {};

export default function ContactForm({ ref_ }: { ref_: string }) {
  const [state, formAction, pending] = useActionState(contactAction, initial);

  if (state.done) {
    return (
      <div className="empty-state" role="status">
        <p>Thanks. Emma will be in touch soon.</p>
      </div>
    );
  }

  return (
    <form className="form" action={formAction}>
      {state.error ? (
        <div className="form-error" role="alert">
          {state.error}
        </div>
      ) : null}
      <input type="hidden" name="ref" value={ref_} />
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="website-hp">Website</label>
        <input
          id="website-hp"
          name="website"
          type="text"
          autoComplete="off"
          tabIndex={-1}
        />
      </div>
      <div>
        <label htmlFor="name">Your name</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={120}
          className="input"
          aria-invalid={state.fieldErrors?.name ? true : undefined}
        />
        {state.fieldErrors?.name ? (
          <span className="muted">{state.fieldErrors.name}</span>
        ) : null}
      </div>
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          maxLength={254}
          className="input"
          aria-invalid={state.fieldErrors?.email ? true : undefined}
        />
      </div>
      <div>
        <label htmlFor="message">Message</label>
        <textarea
          id="message"
          name="message"
          required
          maxLength={5000}
          className="textarea"
        />
      </div>
      <button
        type="submit"
        className="hero-cta"
        disabled={pending}
        aria-disabled={pending}
      >
        {pending ? "Sending..." : "Send"}
      </button>
    </form>
  );
}
