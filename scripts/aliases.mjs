// Semantic names → cache sprite ids (frame 0). These names are part of the public URL contract:
//   /skills/{skill}.png   /slots/{slot}.png
// Only ever add entries; renaming or removing one breaks consumers.

// Keys are the lowercased skill names RuneLite/the hiscores use.
export const SKILLS = {
  attack: 197,
  strength: 198,
  defence: 199,
  ranged: 200,
  prayer: 201,
  magic: 202,
  hitpoints: 203,
  agility: 204,
  herblore: 205,
  thieving: 206,
  crafting: 207,
  fletching: 208,
  mining: 209,
  smithing: 210,
  fishing: 211,
  cooking: 212,
  firemaking: 213,
  woodcutting: 214,
  runecraft: 215,
  slayer: 216,
  farming: 217,
  hunter: 220,
  construction: 221,
  sailing: 228,
};

// Keys are RuneLite's EquipmentInventorySlot names, lowercased. Images are the empty-slot silhouettes.
export const SLOTS = {
  head: 156,
  cape: 157,
  amulet: 158,
  weapon: 159,
  ring: 160,
  body: 161,
  shield: 162,
  legs: 163,
  gloves: 164,
  boots: 165,
  ammo: 166,
};

export const ALIAS_GROUPS = { skills: SKILLS, slots: SLOTS };

export function allSpriteIds() {
  return [...new Set(Object.values(ALIAS_GROUPS).flatMap((group) => Object.values(group)))];
}
