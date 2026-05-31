export const CATEGORY_VALUES = ["ceramics", "art", "beaded_jewelry"] as const;

export type CategoryValue = (typeof CATEGORY_VALUES)[number];

export const CATEGORY_LABELS: Record<CategoryValue, string> = {
  ceramics: "Ceramics",
  art: "Art",
  beaded_jewelry: "Beaded Jewelry",
};

export function isCategoryValue(v: string): v is CategoryValue {
  return (CATEGORY_VALUES as readonly string[]).includes(v);
}

export function formatCategory(tag: string): string {
  if (isCategoryValue(tag)) return CATEGORY_LABELS[tag];
  return tag
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
