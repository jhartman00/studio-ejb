import type { Metadata } from "next";
import { getPageSections, pickSection } from "@/lib/db/queries";
import { sanitizeHtml } from "@/lib/sanitize";
import SafeImage from "@/components/SafeImage";

export const metadata: Metadata = {
  title: "About — Studio EJB",
  description:
    "About Emma and Studio EJB — ceramics, art, and small jewelry handmade in the studio.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About — Studio EJB",
    description:
      "About Emma and Studio EJB — ceramics, art, and small jewelry handmade in the studio.",
    url: "/about",
    type: "website",
  },
};

export default async function AboutPage() {
  let sections: Awaited<ReturnType<typeof getPageSections>> = [];
  try {
    sections = await getPageSections("about");
  } catch {
    // fall through to placeholder
  }
  const intro = pickSection<"about:intro">(sections, "about", "intro");
  const findMe = pickSection<"about:find_me_at">(sections, "about", "find_me_at");

  return (
    <>
      <section className="hero">
        <h1 className="hero-headline">{intro.data.title || "About"}</h1>
      </section>

      {intro.data.portrait_url ? (
        <section className="section">
          <div style={{ maxWidth: "520px" }}>
            <SafeImage
              src={intro.data.portrait_url}
              alt={intro.data.portrait_alt || "Portrait"}
              width={intro.data.portrait_width ?? 1000}
              height={intro.data.portrait_height ?? 1200}
              sizes="(max-width: 600px) 100vw, 520px"
            />
          </div>
        </section>
      ) : null}

      {intro.data.body_html ? (
        <section className="section">
          <div
            className="prose"
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(intro.data.body_html),
            }}
          />
        </section>
      ) : null}

      {findMe.data.links.length > 0 ? (
        <section className="section">
          <h2>Find me at</h2>
          <ul className="contact-methods">
            {findMe.data.links.map((link, idx) => (
              <li key={idx}>
                <strong>{link.label}</strong>
                {link.href ? (
                  <a href={link.href}>{link.href.replace(/^mailto:/, "")}</a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
