// slugify: lowercase, ascii-friendly, dash-separated. Empty input -> "untitled".
//   slugify("Blue Glazed Bowl") === "blue-glazed-bowl"
//   slugify("Pot #3 (2026)") === "pot-3-2026"
//   slugify("") === "untitled"
export function slugify(input: string): string {
  const s = (input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "untitled";
}

// uniqueSlug: pick the base slug if free, else append -2, -3, ...
//   uniqueSlug("Blue Bowl", ["blue-bowl"]) === "blue-bowl-2"
//   uniqueSlug("", []) === "untitled"
export function uniqueSlug(title: string, existing: Iterable<string>): string {
  const base = slugify(title);
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  for (let i = 2; i < 10_000; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  // Astronomically unlikely. Falls back to a timestamp.
  return `${base}-${Date.now()}`;
}
