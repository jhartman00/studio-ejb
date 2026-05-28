import { sql } from "@/lib/db";

type SearchParams = Promise<{ token?: string; done?: string }>;

async function lookupSubscriber(token: string) {
  if (!token || token.length < 8 || token.length > 200) return null;
  try {
    const { rows } = await sql<{ id: number; email: string; status: string }>`
      select id, email, status
      from email_subscribers
      where unsubscribe_token = ${token}
      limit 1
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const done = sp.done === "1";

  if (done) {
    return (
      <section className="hero">
        <h1 className="hero-headline">You are unsubscribed</h1>
        <p className="hero-subhead">
          Studio EJB will not email you again. Thanks for spending a moment with the work.
        </p>
      </section>
    );
  }

  const sub = await lookupSubscriber(token);
  if (!sub) {
    return (
      <section className="hero">
        <h1 className="hero-headline">Link not recognized</h1>
        <p className="hero-subhead">
          This unsubscribe link is missing or expired. If you keep getting
          email you do not want, reply to any message and Emma will remove you
          by hand.
        </p>
      </section>
    );
  }

  if (sub.status === "unsubscribed") {
    return (
      <section className="hero">
        <h1 className="hero-headline">Already unsubscribed</h1>
        <p className="hero-subhead">
          {sub.email} is no longer on the list.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="hero">
        <h1 className="hero-headline">Unsubscribe</h1>
        <p className="hero-subhead">
          Tap the button below to remove {sub.email} from the Studio EJB list.
        </p>
      </section>
      <section className="section">
        <form className="form" action="/api/unsubscribe" method="POST">
          <input type="hidden" name="token" value={token} />
          <button type="submit" className="hero-cta">
            Unsubscribe {sub.email}
          </button>
        </form>
      </section>
    </>
  );
}
