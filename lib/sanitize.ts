import sanitizeHtmlLib from "sanitize-html";

// Server-side HTML sanitizer for Tiptap output and similar rich-text inputs.
// Pure-JS allowlist (no jsdom), so no ESM/CJS interop issues on Vercel Node
// runtime. Allow only the inline tags we expose in the editor toolbar plus
// paragraph structure.

const ALLOWED_TAGS = ["p", "br", "strong", "b", "em", "i", "a", "ul", "ol", "li"];

const OPTIONS: sanitizeHtmlLib.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ["href", "target", "rel"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    // Force every link to open safely. Strip target="_self" etc.
    a: (tagName, attribs) => {
      const href = attribs.href ?? "";
      const next: Record<string, string> = { ...attribs };
      if (href && /^(https?:)?\/\//i.test(href)) {
        next.target = "_blank";
        next.rel = "noopener noreferrer";
      } else {
        delete next.target;
        delete next.rel;
      }
      return { tagName: "a", attribs: next };
    },
  },
};

export function sanitizeHtml(input: string): string {
  if (!input) return "";
  return sanitizeHtmlLib(input, OPTIONS);
}
