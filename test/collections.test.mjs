import assert from "node:assert/strict";
import { test } from "node:test";
import { SKILLS, SLOTS } from "../scripts/aliases.mjs";
import { buildCollections } from "../scripts/collections.mjs";

// A raw definition as IconDump writes it to defs.json; only rendered ids appear there.
const def = (id, name, overrides = {}) => ({
  id,
  name,
  cost: 1,
  stackable: 0,
  tradeable: false,
  geTradeable: false,
  members: false,
  weight: 0,
  wearPos: [-1, -1, -1],
  options: [null, null, null, null, "Drop"],
  notedId: -1,
  notedTemplate: -1,
  placeholderId: -1,
  placeholderTemplate: -1,
  boughtId: -1,
  boughtTemplate: -1,
  ...overrides,
});

const whip = def(4151, "Abyssal whip", {
  examine: "A weapon from the Abyss.",
  cost: 120001,
  tradeable: true,
  geTradeable: true,
  members: true,
  weight: 453,
  wearPos: [3, -1, -1],
  options: [null, "Wield", null, null, "Drop"],
  notedId: 4152,
  placeholderId: 14032,
  params: { 1: 82, 10: 82, 14: 4, 258: 24, 434: 0, 436: 70, 1564: 3 },
});
const notedWhip = def(4152, "Abyssal whip", { cost: 120001, stackable: 1, notedId: 4151, notedTemplate: 799 });
const whipPlaceholder = def(14032, "Abyssal whip", { cost: 0, placeholderId: 4151, placeholderTemplate: 14401 });
const coins = def(995, "Coins", { examine: "Lovely money!", stackable: 1, tradeable: true, placeholderId: 14440 });
const coinPile = def(996, "null", { stackable: 1 });
const blank = def(2749, "", { examine: "" });
const bond = def(13190, "Old school bond", { cost: 2000000, tradeable: true, geTradeable: true, boughtId: 13191 });
const boughtBond = def(13191, "Old school bond", {
  cost: 0,
  tradeable: true,
  geTradeable: true,
  boughtId: 13190,
  boughtTemplate: 13189,
});
const partyhat = def(1038, "Red partyhat", { wearPos: [0, -1, -1], options: [null, "Wear", null, null, "Drop"] });
const shortbow = def(861, "Magic shortbow", {
  wearPos: [3, 5, -1],
  params: { 4: 69, 13: 7, 14: 4, 23: 50, 434: 4, 436: 50, 1562: 3, 1563: 50, 1564: 3 },
});
const occult = def(12002, "Occult necklace", {
  wearPos: [2, -1, -1],
  params: { 0: 0, 3: 12, 11: 2, 299: 50, 434: 6, 436: 70 },
});
const arrow = def(892, "Rune arrow", { stackable: 1, wearPos: [13, -1, -1], params: { 12: 49, 23: 40 } });
const voidHelm = def(11663, "Void mage helm", {
  wearPos: [0, 8, -1],
  params: {
    5: 6, 6: 6, 7: 6, 8: 6, 9: 6, 434: 0, 435: 2, 436: 42, 437: 42, 191: 1, 579: 4,
    610: 6, 611: 3, 612: 5, 613: 42, 614: 42, 615: 42, 616: 42, 617: 22,
  },
});
const questCape = def(9813, "Quest point cape", {
  wearPos: [1, -1, -1],
  params: { 5: 9, 6: 9, 7: 9, 8: 9, 9: 9, 13: 0, 14: 0, 451: "Trim", 452: "Teleport" },
});
const baIcon = def(10556, "Attacker icon", { wearPos: [11, -1, -1] });
const beads = def(21816, "Beads of the dead", { wearPos: [2, -1, -1], params: { 11: 1, 13: 1, 14: 1 } });
const raidPotion = def(20990, "Overload (2)", { stackable: 2 });

const all = [
  whip, notedWhip, whipPlaceholder, coins, coinPile, blank, bond, boughtBond, partyhat, shortbow, occult,
  arrow, voidHelm, questCape, baIcon, beads, raidPotion,
];
const built = buildCollections(all);

test("a base item carries its game data and links to its noted and placeholder ids", () => {
  assert.deepEqual(built.items[4151], {
    name: "Abyssal whip",
    examine: "A weapon from the Abyss.",
    value: 120001,
    highalch: 72000,
    lowalch: 48000,
    members: true,
    tradeable: true,
    ge: true,
    weight: 0.453,
    options: ["Wield", "Drop"],
    noted: 4152,
    placeholder: 14032,
  });
});

test("fields that are false, zero or absent are left out", () => {
  assert.deepEqual(built.items[1038], {
    name: "Red partyhat",
    value: 1,
    highalch: 0,
    lowalch: 0,
    options: ["Wear", "Drop"],
  });
  assert.equal(built.items[995].stackable, true);
  assert.equal("stackable" in built.items[20990], false); // the cache's 2 does not mean it stacks
});

test("noted and placeholder ids map to their base item and are not listed as items", () => {
  assert.deepEqual(built.noted, { 4152: 4151 });
  assert.deepEqual(built.placeholders, { 14032: 4151 });
  assert.equal(built.items[4152], undefined);
  assert.equal(built.items[14032], undefined);
});

test("ids the cache names null or leaves blank are not listed", () => {
  assert.equal(built.items[996], undefined);
  assert.equal(built.items[2749], undefined);
});

test("a link is only published when its target has an icon", () => {
  assert.equal("placeholder" in built.items[995], false); // 14440 was not rendered
  assert.equal("noted" in built.items[995], false);
});

test("a bought item is listed and linked both ways", () => {
  assert.equal(built.items[13190].bought, 13191);
  assert.equal(built.items[13191].base, 13190);
  assert.equal("base" in built.items[13190], false);
  assert.equal(built.items[13190].tradeable, true);
  assert.equal("tradeable" in built.items[13191], false);
  assert.equal("ge" in built.items[13191], false);
});

test("equipment gets the full bonus block, and weapons their speed", () => {
  assert.deepEqual(built.equipment[4151], {
    slot: "weapon",
    attack: { stab: 0, slash: 82, crush: 0, magic: 0, ranged: 0 },
    defence: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 },
    strength: 82,
    rangedStrength: 0,
    magicDamage: 0,
    prayer: 0,
    speed: 4,
  });
});

test("two-handed weapons, attack range and ranged strength", () => {
  assert.equal(built.equipment[861].twoHanded, true);
  assert.equal(built.equipment[861].range, 7);
  assert.equal(built.equipment[861].attack.ranged, 69);
  assert.equal("twoHanded" in built.equipment[4151], false);
  assert.equal(built.equipment[892].slot, "ammo");
  assert.equal(built.equipment[892].rangedStrength, 49);
});

test("magic damage is a percentage", () => {
  assert.equal(built.equipment[12002].magicDamage, 5);
  assert.equal(built.equipment[12002].attack.magic, 12);
  assert.equal(built.equipment[12002].prayer, 2);
});

test("skill requirements are not published", () => {
  assert.equal("requirements" in built.equipment[11663], false);
});

test("equipment without params or weapon stats still gets a zeroed bonus block", () => {
  assert.deepEqual(built.equipment[1038], {
    slot: "head",
    attack: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 },
    defence: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 },
    strength: 0,
    rangedStrength: 0,
    magicDamage: 0,
    prayer: 0,
  });
  assert.equal("speed" in built.equipment[9813], false);
  assert.equal("range" in built.equipment[9813], false);
});

test("speed and range are weapon stats only", () => {
  assert.equal(built.equipment[21816].prayer, 1);
  assert.equal("speed" in built.equipment[21816], false);
  assert.equal("range" in built.equipment[21816], false);
});

test("only items worn in a published slot are equipment", () => {
  assert.equal(built.equipment[10556], undefined); // wearPos 11 has no slot icon
  assert.equal(built.equipment[995], undefined);
  assert.ok(built.items[10556]);
  for (const entry of Object.values(built.equipment)) assert.ok(entry.slot in SLOTS);
});

test("skills and slots list the alias names", () => {
  assert.deepEqual(built.skills, Object.keys(SKILLS));
  assert.deepEqual(built.slots, Object.keys(SLOTS));
});
