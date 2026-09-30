// Reference resolver for the icons.scapekeeper.com URL contract. Copy it into a consumer; it has no
// dependencies. See README.md for the Python equivalent.

export const DEFAULT_ICONS_URL = "https://icons.scapekeeper.com";

/** Normalises a configured base URL. Returns null when icons are disabled (empty string). */
export function iconsBase(configured = DEFAULT_ICONS_URL) {
  const base = (configured ?? DEFAULT_ICONS_URL).trim().replace(/\/+$/, "");
  return base === "" ? null : base;
}

/**
 * The item id whose image shows `quantity` of `itemId`: coins 995 × 250 → 1001.
 * `stacks` is /data/stacks.json: {"995": [[2, 996], [3, 997], ...]} sorted by breakpoint.
 */
export function stackedItemId(stacks, itemId, quantity = 1) {
  const table = stacks?.[itemId];
  if (!table) return itemId;
  let id = itemId;
  for (const [breakpoint, variant] of table) {
    if (quantity >= breakpoint) id = variant;
  }
  return id;
}

export function itemIconUrl(base, stacks, itemId, quantity = 1) {
  if (!base || itemId == null || itemId < 0) return null;
  return `${base}/items/${stackedItemId(stacks, itemId, quantity)}.webp`;
}

/** "Attack" / "attack" → /skills/attack.png. Overall has no icon. */
export function skillIconUrl(base, skill) {
  if (!base || !skill) return null;
  const slug = String(skill).toLowerCase();
  return slug === "overall" ? null : `${base}/skills/${slug}.png`;
}

/** RuneLite EquipmentInventorySlot name ("HEAD", "AMULET", ...) → empty-slot silhouette. */
export function slotIconUrl(base, slot) {
  if (!base || !slot) return null;
  return `${base}/slots/${String(slot).toLowerCase()}.png`;
}
