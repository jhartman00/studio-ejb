import type { Metadata } from "next";
import { getPageSections, pickSection } from "@/lib/db/queries";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact — Studio EJB",
  description:
    "Get in touch with Studio EJB about commissions, wholesale, press, or upcoming work.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact — Studio EJB",
    description:
      "Get in touch with Studio EJB about commissions, wholesale, press, or upcoming work.",
    url: "/contact",
    type: "website",
  },
};

type SearchParams = Promise<{ ref?: string }>;

export default async function ContactPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const ref = typeof sp.ref === "string" ? sp.ref.slice(0, 64) : "";

  let sections: Awaited<ReturnType<typeof getPageSections>> = [];
  try {
    sections = await getPageSections("contact");
  } catch {
    // ignore
  }
  const intro = pickSection<"contact:intro">(sections, "contact", "intro");
  const methods = pickSection<"contact:methods">(sections, "contact", "methods");

  return (
    <>
      <section className="hero">
        <h1 className="hero-headline">{intro.data.title || "Contact"}</h1>
        {intro.data.body ? (
          <p className="hero-subhead">{intro.data.body}</p>
        ) : null}
      </section>

      <section className="section">
        <ContactForm ref_={ref} />
      </section>

      {methods.data.methods.length > 0 ? (
        <section className="section">
          <h2>Other ways to reach me</h2>
          <ul className="contact-methods">
            {methods.data.methods.map((m, idx) => (
              <li key={idx}>
                <strong>{m.label}</strong>
                {m.value}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
