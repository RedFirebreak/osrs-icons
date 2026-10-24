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

// Keys are the hiscores' activity names ("Kree'Arra", "Clue Scrolls (all)", "LMS - Rank"), lowercased,
// apostrophes dropped and every other run of characters that aren't a-z or 0-9 made one "_" (see
// hiscoreSlug in clients/osrs-icons.mjs). Images are the sprites RuneLite's hiscore panel draws for
// them (net.runelite.client.hiscore.HiscoreSkill). Clue tiers have none: use the clue scroll items.
export const HISCORES = {
  league_points: 5857, // League Points
  bounty_hunter_hunter: 5854, // Bounty Hunter - Hunter
  bounty_hunter_rogue: 5855, // Bounty Hunter - Rogue
  clue_scrolls_all: 5853, // Clue Scrolls (all)
  lms_rank: 5856, // LMS - Rank
  pvp_arena_rank: 5859, // PvP Arena - Rank
  soul_wars_zeal: 5858, // Soul Wars Zeal
  rifts_closed: 5860, // Rifts closed
  colosseum_glory: 5862, // Colosseum Glory
  collections_logged: 6390, // Collections Logged
  abyssal_sire: 4276, // Abyssal Sire
  alchemical_hydra: 4289, // Alchemical Hydra
  amoxliatl: 5639, // Amoxliatl
  araxxor: 5638, // Araxxor
  artio: 5622, // Artio
  barrows_chests: 4267, // Barrows Chests
  brutus: 6352, // Brutus
  bryophyta: 4262, // Bryophyta
  callisto: 5622, // Callisto
  calvarion: 5623, // Calvar'ion
  cerberus: 4280, // Cerberus
  chambers_of_xeric: 4288, // Chambers of Xeric
  chambers_of_xeric_challenge_mode: 4296, // Chambers of Xeric: Challenge Mode
  chaos_elemental: 5621, // Chaos Elemental
  chaos_fanatic: 5625, // Chaos Fanatic
  commander_zilyana: 4284, // Commander Zilyana
  corporeal_beast: 4287, // Corporeal Beast
  crazy_archaeologist: 5626, // Crazy Archaeologist
  dagannoth_prime: 4294, // Dagannoth Prime
  dagannoth_rex: 4293, // Dagannoth Rex
  dagannoth_supreme: 4292, // Dagannoth Supreme
  deranged_archaeologist: 5627, // Deranged Archaeologist
  doom_of_mokhaiotl: 6347, // Doom of Mokhaiotl
  duke_sucellus: 5632, // Duke Sucellus
  the_fractured_archive: 8360, // The Fractured Archive
  general_graardor: 4282, // General Graardor
  giant_mole: 4263, // Giant Mole
  grotesque_guardians: 4264, // Grotesque Guardians
  hespori: 4271, // Hespori
  kalphite_queen: 4270, // Kalphite Queen
  king_black_dragon: 4274, // King Black Dragon
  kraken: 4275, // Kraken
  kreearra: 4285, // Kree'Arra
  kril_tsutsaroth: 4283, // K'ril Tsutsaroth
  lunar_chests: 5637, // Lunar Chests
  mad_angel: 8359, // Mad Angel
  maggot_king: 8358, // Maggot King
  mimic: 4260, // Mimic
  nex: 4291, // Nex
  nightmare: 4286, // Nightmare
  phosanis_nightmare: 4286, // Phosani's Nightmare
  obor: 4261, // Obor
  phantom_muspah: 4299, // Phantom Muspah
  sarachnis: 4269, // Sarachnis
  scorpia: 5628, // Scorpia
  scurrius: 5635, // Scurrius
  shellbane_gryphon: 6349, // Shellbane Gryphon
  skotizo: 4272, // Skotizo
  sol_heredit: 5636, // Sol Heredit
  spindel: 5624, // Spindel
  tempoross: 4265, // Tempoross
  the_gauntlet: 4278, // The Gauntlet
  the_corrupted_gauntlet: 4295, // The Corrupted Gauntlet
  the_hueycoatl: 5640, // The Hueycoatl
  the_leviathan: 5633, // The Leviathan
  the_royal_titans: 6345, // The Royal Titans
  the_whisperer: 5631, // The Whisperer
  theatre_of_blood: 4290, // Theatre of Blood
  theatre_of_blood_hard_mode: 4290, // Theatre of Blood: Hard Mode
  thermonuclear_smoke_devil: 4277, // Thermonuclear Smoke Devil
  tombs_of_amascut: 4297, // Tombs of Amascut
  tombs_of_amascut_expert_mode: 4298, // Tombs of Amascut: Expert Mode
  tzkal_zuk: 5630, // TzKal-Zuk
  tztok_jad: 5629, // TzTok-Jad
  vardorvis: 5634, // Vardorvis
  venenatis: 5624, // Venenatis
  vetion: 5623, // Vet'ion
  vorkath: 4281, // Vorkath
  wintertodt: 4266, // Wintertodt
  yama: 6346, // Yama
  zalcano: 4273, // Zalcano
  zulrah: 4279, // Zulrah
};

export const ALIAS_GROUPS = { skills: SKILLS, slots: SLOTS, prayers: PRAYERS, hiscores: HISCORES };

export function allSpriteIds() {
  return [...new Set(Object.values(ALIAS_GROUPS).flatMap((group) => Object.values(group)))];
}
