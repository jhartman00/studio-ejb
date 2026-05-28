// titleFromFilename: derive a friendly title from a camera/phone filename.
// Strips extension, common camera prefixes (IMG_, DSC, DSC_, GOPR, MVI_),
// and bare numeric chunks. Title-cases the rest. Junky names → "Untitled".
//
//   titleFromFilename("IMG_2024_pot.jpg") === "Pot"
//   titleFromFilename("blue_glazed_bowl.JPG") === "Blue Glazed Bowl"
//   titleFromFilename("DSC00123.png") === "Untitled"
//   titleFromFilename("") === "Untitled"
export function titleFromFilename(filename: string): string {
  if (!filename) return "Untitled";
  let s = filename.replace(/\\/g, "/").split("/").pop() || "";
  s = s.replace(/\.[a-z0-9]+$/i, "");
  s = s.replace(/^(IMG|DSC|DSCN|GOPR|MVI|VID|PXL|PIC)[_-]?/i, "");
  s = s.replace(/[_\-]+/g, " ");
  const tokens = s
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !/^\d+$/.test(t));
  if (tokens.length === 0) return "Untitled";
  return tokens
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
    .join(" ");
}
