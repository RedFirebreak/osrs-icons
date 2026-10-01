// Shapes the raw item definitions IconDump writes (defs.json, one record per rendered id) into the
// published data files:
//   /data/items.json  /data/noted.json  /data/placeholders.json  /data/equipment.json
//   /data/skills.json  /data/slots.json
// A collection only ever lists ids that have an icon. Field names are part of the public contract:
// only ever add to them.
import { SKILLS, SLOTS } from "./aliases.mjs";

// ItemDefinition.wearPos1 → slot name. Positions without a slot icon (6 arms, 8 hair, 11 jaw) are
// not equipment slots a player sees.
const WEAR_SLOTS = {
  0: "head", 1: "cape", 2: "amulet", 3: "weapon", 4: "body", 5: "shield", 7: "legs", 9: "gloves",
  10: "boots", 12: "ring", 13: "ammo",
};
const SHIELD_POS = 5;

// The cache doesn't name its params. These were matched against the in-game equipment stats of
// well-known items (whip, rune platebody, magic shortbow, occult necklace, twisted bow, ...).
// Skill requirements (params 434-437) are left out on purpose: for some items they hold the level
// to make the item, not to wear it.
const ATTACK = { stab: 0, slash: 1, crush: 2, magic: 3, ranged: 4 };
const DEFENCE = { stab: 5, slash: 6, crush: 7, magic: 8, ranged: 9 };
const PARAM = { strength: 10, prayer: 11, rangedStrength: 12, range: 13, speed: 14, magicDamage: 299 };

// Stack variants and interface-only models are named "null" in the cache; a few are left blank.
const isNamed = (def) => Boolean(def.name?.trim()) && def.name.toLowerCase() !== "null";
const param = (def, id) => (Number.isInteger(def.params?.[id]) ? def.params[id] : 0);
const bonuses = (def, table) => Object.fromEntries(Object.entries(table).map(([k, id]) => [k, param(def, id)]));

function itemEntry(def, rendered) {
  const entry = { name: def.name };
  if (def.examine) entry.examine = def.examine;
  entry.value = def.cost;
  // Integer maths: cost * 0.6 can land just under a whole number.
  entry.highalch = Math.floor((def.cost * 3) / 5);
  entry.lowalch = Math.floor((def.cost * 2) / 5);
  // A bought item is the untradeable copy the Grand Exchange hands out (a bought bond); the cache
  // library leaves its base's trade flags on it.
  const bought = def.boughtTemplate !== -1;
  if (def.members) entry.members = true;
  if (def.tradeable && !bought) entry.tradeable = true;
  if (def.geTradeable && !bought) entry.ge = true;
  // 2 is not "stackable": raid potions and charged weapons carry it.
  if (def.stackable === 1) entry.stackable = true;
  if (def.weight) entry.weight = def.weight / 1000; // grams → kg, as the game shows it
  const options = (def.options ?? []).filter(Boolean);
  if (options.length) entry.options = options;
  if (rendered.has(def.notedId)) entry.noted = def.notedId;
  if (rendered.has(def.placeholderId)) entry.placeholder = def.placeholderId;
  if (bought) entry.base = def.boughtId;
  else if (rendered.has(def.boughtId)) entry.bought = def.boughtId;
  return entry;
}

function equipmentEntry(def, slot) {
  const weapon = slot === "weapon";
  const entry = { slot };
  if (weapon && def.wearPos.slice(1).includes(SHIELD_POS)) entry.twoHanded = true;
  entry.attack = bonuses(def, ATTACK);
  entry.defence = bonuses(def, DEFENCE);
  entry.strength = param(def, PARAM.strength);
  entry.rangedStrength = param(def, PARAM.rangedStrength);
  entry.magicDamage = param(def, PARAM.magicDamage) / 10; // stored in tenths of a percent
  entry.prayer = param(def, PARAM.prayer);
  if (weapon && param(def, PARAM.speed) > 0) entry.speed = param(def, PARAM.speed);
  if (weapon && param(def, PARAM.range) > 0) entry.range = param(def, PARAM.range);
  return entry;
}

export function buildCollections(defs) {
  const rendered = new Set(defs.map((def) => def.id));
  const items = {};
  const noted = {};
  const placeholders = {};
  const equipment = {};

  for (const def of defs) {
    if (def.notedTemplate !== -1) {
      noted[def.id] = def.notedId;
    } else if (def.placeholderTemplate !== -1) {
      placeholders[def.id] = def.placeholderId;
    } else if (isNamed(def)) {
      items[def.id] = itemEntry(def, rendered);
      const slot = WEAR_SLOTS[def.wearPos[0]];
      if (slot) equipment[def.id] = equipmentEntry(def, slot);
    }
  }

  return { items, noted, placeholders, equipment, skills: Object.keys(SKILLS), slots: Object.keys(SLOTS) };
}
