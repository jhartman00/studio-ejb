import DOMPurify from "isomorphic-dompurify";

// Server-side HTML sanitizer for Tiptap output. Allow only the inline
// tags we expose in the editor toolbar plus paragraph structure.
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "a",
  "ul",
  "ol",
  "li",
];
const ALLOWED_ATTR = ["href", "target", "rel"];

export function sanitizeHtml(input: string): string {
  if (!input) return "";
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|\/)/i,
    ADD_ATTR: ["target", "rel"],
  });
}
