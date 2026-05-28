"use client";

// Phase 3: placeholder UI only. The Server Action ships in Phase 5.

export default function ContactForm({ ref_ }: { ref_: string }) {
  return (
    <form className="form" action="/api/contact-todo" method="post">
      <input type="hidden" name="ref" value={ref_} />
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="website-hp">Website</label>
        <input id="website-hp" name="website" type="text" autoComplete="off" tabIndex={-1} />
      </div>
      <div>
        <label htmlFor="name">Your name</label>
        <input id="name" name="name" type="text" required maxLength={120} className="input" />
      </div>
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required maxLength={254} className="input" />
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
      <button type="submit" className="hero-cta" disabled aria-disabled="true">
        Send (form wires up in next phase)
      </button>
    </form>
  );
}
