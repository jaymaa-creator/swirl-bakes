export const COLLECTION_KEY = "bun-bounce-collection-v1";
export const COLLECTIBLES = [
  ...["Cream", "Caramel", "Chocolate", "Grey"].map((name, variant) => ({ id: `dog-${variant}`, name: `${name} fluffball`, kind: "dog", variant, threshold: 30 })),
  ...["KTV", "Pub", "Lounge"].map((name, variant) => ({ id: `night-${variant}`, name, kind: "night", variant, threshold: 30 })),
  { id: "coffee", name: "Viral Coffee", kind: "coffee", threshold: 40 },
  ...["Banh Mi", "Pho", "Saigon", "Little Hanoi"].map((name, variant) => ({ id: `viet-${variant}`, name, kind: "viet", variant, threshold: 50 })),
  { id: "heritage", name: "Peranakan postcards", kind: "heritage", threshold: 60, span: 3 },
  { id: "motorbike", name: "Motorbike Bar", kind: "motorbike", threshold: 80, span: 2 },
  { id: "hq", name: "Swirl Girl HQ", kind: "hq", threshold: 100 },
];
export const itemById = (id) => COLLECTIBLES.find((item) => item.id === id);
export function readCollection(storage) {
  try {
    const value = JSON.parse(storage.getItem(COLLECTION_KEY));
    return Array.isArray(value) ? [...new Set(value.filter((id) => itemById(id)))] : [];
  } catch { return []; }
}
export function mergeCollection(owned, found) {
  return [...new Set([...owned, ...found].filter((id) => itemById(id)))];
}
export function scoreMessage(score) {
  if (score < 3) return "Aaiyoo, not good.";
  if (score < 10) return "Why so bad ah?";
  if (score < 30) return "Must try harder wan";
  if (score < 60) return "Not bad lor";
  return "Very good lah!";
}
export function createEncounter(score, number, random = Math.random) {
  const groups = ["dog", "night", "coffee", "viet", "heritage", "motorbike", "hq"]
    .filter((kind) => COLLECTIBLES.some((item) => item.kind === kind && score >= item.threshold));
  if (!groups.length) return [];
  const kind = groups[Math.min(groups.length - 1, Math.floor(random() * groups.length))];
  const items = COLLECTIBLES.filter((item) => item.kind === kind);
  const appearance = { crowd: Math.floor(random() * 3), neon: Math.floor(random() * 3) };
  if (kind === "viet") return items.map((item, offset) => ({ number: number + offset, id: item.id, span: 1, ...appearance }));
  const item = items[Math.min(items.length - 1, Math.floor(random() * items.length))];
  return [{ number, id: item.id, span: item.span || 1, ...appearance }];
}
