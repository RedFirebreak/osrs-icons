// Semantic names → cache sprite ids (frame 0). These names are part of the public URL contract:
//   /skills/{skill}.png   /slots/{slot}.png   /prayers/{prayer}.png
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

// Keys are RuneLite's Prayer enum names, lowercased (what the exporter plugin sends in
// player.activePrayers). Images are the lit prayer-book icons: SpriteID.Prayeron for the standard
// book, SpriteID.IconPrayerZaros01_30x30 for Ruinous Powers (RP_*).
export const PRAYERS = {
  thick_skin: 115,
  burst_of_strength: 116,
  clarity_of_thought: 117,
  sharp_eye: 133,
  mystic_will: 134,
  rock_skin: 118,
  superhuman_strength: 119,
  improved_reflexes: 120,
  rapid_restore: 121,
  rapid_heal: 122,
  protect_item: 123,
  hawk_eye: 502,
  mystic_lore: 503,
  steel_skin: 124,
  ultimate_strength: 125,
  incredible_reflexes: 126,
  protect_from_magic: 127,
  protect_from_missiles: 128,
  protect_from_melee: 129,
  eagle_eye: 504,
  mystic_might: 505,
  retribution: 131,
  redemption: 130,
  smite: 132,
  chivalry: 945,
  deadeye: 1422,
  mystic_vigour: 1423,
  piety: 946,
  preserve: 947,
  rigour: 1420,
  augury: 1421,
  zeal: 8595,
  rp_rejuvenation: 4842,
  rp_ancient_strength: 4843,
  rp_ancient_sight: 4844,
  rp_ancient_will: 4845,
  rp_protect_item: 4865,
  rp_ruinous_grace: 4846,
  rp_dampen_magic: 4847,
  rp_dampen_ranged: 4848,
  rp_dampen_melee: 4849,
  rp_trinitas: 4850,
  rp_berserker: 4851,
  rp_purge: 4852,
  rp_metabolise: 4853,
  rp_rebuke: 4857,
  rp_vindication: 4863,
  rp_decimate: 4854,
  rp_annihilate: 4855,
  rp_vaporise: 4856,
  rp_fumus_vow: 4858,
  rp_umbra_vow: 4859,
  rp_cruors_vow: 4860,
  rp_glacies_vow: 4861,
  rp_wrath: 4862,
  rp_intensify: 4864,
};

export const ALIAS_GROUPS = { skills: SKILLS, slots: SLOTS, prayers: PRAYERS };

export function allSpriteIds() {
  return [...new Set(Object.values(ALIAS_GROUPS).flatMap((group) => Object.values(group)))];
}
