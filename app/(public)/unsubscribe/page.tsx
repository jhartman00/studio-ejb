type SearchParams = Promise<{ token?: string }>;

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  return (
    <>
      <section className="hero">
        <h1 className="hero-headline">Unsubscribe</h1>
        <p className="hero-subhead">
          The unsubscribe handler wires up in Phase 5. Token received:{" "}
          {token ? `${token.slice(0, 8)}…` : "(none)"}
        </p>
      </section>
    </>
  );
}
