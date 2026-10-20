// Sanity gate between build and publish. Exits non-zero (and publishes nothing) when the output
// looks broken or incomplete.
//
//   node scripts/verify.mjs dist [--previous https://icons.scapekeeper.com/manifest.json]
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ALIAS_GROUPS } from "./aliases.mjs";

const MIN_ITEMS = 28000;
const MIN_NOTED = 3000;
const MIN_PLACEHOLDERS = 5000;
const MIN_STACKS = 300;
const MIN_NAMED = 15000;
const MIN_EQUIPMENT = 5000;
// A new cache only ever adds items; a big drop means a partial or broken cache.
const MAX_ITEM_DROP = 0.02;
// The world map. A game update adds an area now and then and rarely removes one; a map that shrinks
// by more than this lost map squares (a partial cache, or regions it couldn't read).
const MIN_MAP_TILES = 10000;
const MIN_GROUND_TILES = 2500;
const MIN_MAP_ICONS = 100;
const MIN_MAP_LABELS = 900;
const MAX_MAP_TILE_DROP = 0.02;
// Lumbridge, Varrock and the Grand Exchange: on the ground floor whatever else changes.
const REQUIRED_MAP_TILES = ["0_50_50", "0_50_53", "0_49_54"];
const REQUIRED_ITEMS = [
  995, 996, 997, 998, 999, 1000, 1001, 1002, 1003, 1004, // coins + every stack variant
  4151, // abyssal whip
  4152, // abyssal whip (noted)
  13190, // old school bond
];

export async function verify(dist, previousManifest) {
  const errors = [];
  const fail = (msg) => errors.push(msg);

  const manifestPath = path.join(dist, "manifest.json");
  if (!fs.existsSync(manifestPath)) return ["manifest.json missing"];
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.schema !== 1) fail(`manifest.schema is ${manifest.schema}, expected 1`);
  if (!manifest.openrs2?.id) fail("manifest.openrs2.id missing");
  if (!manifest.generator) fail("manifest.generator missing");

  const items = new Set(fs.readdirSync(path.join(dist, "items")));
  if (items.size < MIN_ITEMS) fail(`only ${items.size} item icons (expected >= ${MIN_ITEMS})`);
  if (manifest.counts?.items !== items.size) fail(`manifest counts.items=${manifest.counts?.items} but ${items.size} files`);
  if ((manifest.counts?.noted ?? 0) < MIN_NOTED) fail(`only ${manifest.counts?.noted} noted icons`);
  if ((manifest.counts?.placeholders ?? 0) < MIN_PLACEHOLDERS) fail(`only ${manifest.counts?.placeholders} placeholder icons`);
  for (const id of REQUIRED_ITEMS) {
    if (!items.has(`${id}.webp`)) fail(`required item ${id} missing`);
  }

  for (const [group, table] of Object.entries(ALIAS_GROUPS)) {
    for (const name of Object.keys(table)) {
      if (!fs.existsSync(path.join(dist, group, `${name}.png`))) fail(`${group}/${name}.png missing`);
    }
  }

  const stacks = JSON.parse(fs.readFileSync(path.join(dist, "data", "stacks.json"), "utf8"));
  const stackIds = Object.keys(stacks);
  if (stackIds.length < MIN_STACKS) fail(`only ${stackIds.length} stack tables (expected >= ${MIN_STACKS})`);
  for (const [id, table] of Object.entries(stacks)) {
    if (!Array.isArray(table) || table.some((e) => !Array.isArray(e) || e.length !== 2)) {
      fail(`stacks[${id}] is malformed`);
    }
  }

  // The collections index the icons: every id they list or link to must have a file.
  const data = (name) => {
    const file = path.join(dist, "data", `${name}.json`);
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
    fail(`data/${name}.json missing`);
    return {};
  };
  const hasIcon = (id) => items.has(`${id}.webp`);
  const named = data("items");
  const noted = data("noted");
  const placeholders = data("placeholders");
  const equipment = data("equipment");

  const namedIds = Object.keys(named);
  if (namedIds.length < MIN_NAMED) fail(`only ${namedIds.length} named items (expected >= ${MIN_NAMED})`);
  if (manifest.counts?.named !== namedIds.length) fail(`manifest counts.named=${manifest.counts?.named} but ${namedIds.length} entries`);
  for (const [id, entry] of Object.entries(named)) {
    if (!entry.name) fail(`data/items.json: ${id} has no name`);
    if (!hasIcon(id)) fail(`data/items.json: ${id} has no icon`);
    for (const link of ["noted", "placeholder", "bought", "base"]) {
      if (entry[link] != null && !hasIcon(entry[link])) fail(`data/items.json: ${id}.${link}=${entry[link]} has no icon`);
    }
  }
  if (named[995]?.name !== "Coins") fail("data/items.json: 995 is not Coins");
  if (named[4151]?.noted !== 4152) fail("data/items.json: 4151 does not link to its noted id 4152");

  for (const [name, table, count] of [["noted", noted, manifest.counts?.noted], ["placeholders", placeholders, manifest.counts?.placeholders]]) {
    const ids = Object.keys(table);
    if (ids.length !== count) fail(`data/${name}.json has ${ids.length} entries but manifest counts.${name}=${count}`);
    for (const id of ids) {
      if (!hasIcon(id)) fail(`data/${name}.json: ${id} has no icon`);
      if (!Number.isInteger(table[id])) fail(`data/${name}.json: ${id} has no base id`);
    }
  }

  const equipmentIds = Object.keys(equipment);
  if (equipmentIds.length < MIN_EQUIPMENT) fail(`only ${equipmentIds.length} equipment entries (expected >= ${MIN_EQUIPMENT})`);
  if (manifest.counts?.equipment !== equipmentIds.length) fail(`manifest counts.equipment=${manifest.counts?.equipment} but ${equipmentIds.length} entries`);
  for (const [id, entry] of Object.entries(equipment)) {
    if (!named[id]) fail(`data/equipment.json: ${id} is not in data/items.json`);
    if (!(entry.slot in ALIAS_GROUPS.slots)) fail(`data/equipment.json: ${id} has unknown slot ${entry.slot}`);
  }
  // The cache doesn't name the params the bonuses are read from. These loose checks catch a
  // renumbering without failing on a balance change.
  const whip = equipment[4151];
  const platebody = equipment[1127];
  const shortbow = equipment[861];
  if (!(whip?.slot === "weapon" && whip.attack.slash > 0 && whip.strength > 0 && whip.speed > 0)) fail("data/equipment.json: abyssal whip (4151) bonuses look wrong");
  if (!(platebody?.slot === "body" && platebody.defence.slash > 0 && platebody.attack.magic < 0)) fail("data/equipment.json: rune platebody (1127) bonuses look wrong");
  if (!(shortbow?.twoHanded && shortbow.attack.ranged > 0 && shortbow.range > 1)) fail("data/equipment.json: magic shortbow (861) bonuses look wrong");

  for (const group of Object.keys(ALIAS_GROUPS)) {
    const listed = data(group);
    if (JSON.stringify(listed) !== JSON.stringify(Object.keys(ALIAS_GROUPS[group]))) fail(`data/${group}.json does not match the ${group} aliases`);
  }

  verifyMap(dist, manifest, fail);

  for (const dir of ["items", "data", ...Object.keys(ALIAS_GROUPS)]) {
    for (const file of fs.readdirSync(path.join(dist, dir))) {
      if (fs.statSync(path.join(dist, dir, file)).size === 0) fail(`${dir}/${file} is empty`);
    }
  }

  if (previousManifest?.counts?.items) {
    const floor = Math.floor(previousManifest.counts.items * (1 - MAX_ITEM_DROP));
    if (items.size < floor) {
      fail(`item count dropped from ${previousManifest.counts.items} to ${items.size} (floor ${floor})`);
    }
  }

  if (previousManifest?.counts?.mapTiles) {
    const floor = Math.floor(previousManifest.counts.mapTiles * (1 - MAX_MAP_TILE_DROP));
    if ((manifest.counts?.mapTiles ?? 0) < floor) {
      fail(`map tile count dropped from ${previousManifest.counts.mapTiles} to ${manifest.counts?.mapTiles} (floor ${floor})`);
    }
  }

  return errors;
}

/** data/map.json lists exactly what is under map/, and every file it names is there. */
export function verifyMap(dist, manifest, fail) {
  const mapFile = path.join(dist, "data", "map.json");
  if (!fs.existsSync(mapFile)) return fail("data/map.json missing");
  const map = JSON.parse(fs.readFileSync(mapFile, "utf8"));
  const files = (dir) => {
    const abs = path.join(dist, "map", dir);
    return new Set(fs.existsSync(abs) ? fs.readdirSync(abs) : []);
  };

  const tiles = files("tiles");
  const listed = (map.tiles ?? []).flatMap((floor, plane) => floor.map((xy) => `${plane}_${xy}.webp`));
  if (tiles.size < MIN_MAP_TILES) fail(`only ${tiles.size} map tiles (expected >= ${MIN_MAP_TILES})`);
  if ((map.tiles?.[0]?.length ?? 0) < MIN_GROUND_TILES) fail(`only ${map.tiles?.[0]?.length ?? 0} ground-floor map tiles`);
  if (listed.length !== tiles.size || listed.some((file) => !tiles.has(file))) {
    fail(`data/map.json lists ${listed.length} tiles, map/tiles/ has ${tiles.size}`);
  }
  if (manifest.counts?.mapTiles !== tiles.size) fail(`manifest counts.mapTiles=${manifest.counts?.mapTiles} but ${tiles.size} files`);
  for (const tile of REQUIRED_MAP_TILES) {
    if (!tiles.has(`${tile}.webp`)) fail(`map tile ${tile} missing`);
  }

  for (const [level, floors] of Object.entries(map.levels ?? {})) {
    const have = files(path.join("zoom", level));
    for (const [plane, floor] of floors.entries()) {
      for (const xy of floor) if (!have.has(`${plane}_${xy}.webp`)) fail(`map/zoom/${level}/${plane}_${xy}.webp missing`);
    }
  }
  if (Object.keys(map.levels ?? {}).length !== 3) fail("data/map.json should have 3 zoom levels");

  if (!map.icons?.sheet || !fs.existsSync(path.join(dist, "map", map.icons.sheet))) fail(`map icon sheet ${map.icons?.sheet} missing`);
  if ((manifest.counts?.mapIcons ?? 0) < MIN_MAP_ICONS) fail(`only ${manifest.counts?.mapIcons} kinds of map icon`);

  const labels = files("labels");
  const labelFiles = map.labels?.files ?? [];
  if (labelFiles.length < MIN_MAP_LABELS) fail(`only ${labelFiles.length} map labels (expected >= ${MIN_MAP_LABELS})`);
  for (const name of labelFiles) if (!labels.has(`${name}.webp`)) fail(`map label ${name}.webp missing`);
  if ((map.labels?.major ?? []).some((i) => labelFiles[i] === undefined)) fail("data/map.json: a major label points past the labels");
  if (!(map.labels?.major?.length > 10)) fail("data/map.json: hardly any labels name a region or a sea");

  for (const dir of ["tiles", "labels", "icons"]) {
    for (const file of files(dir)) {
      if (fs.statSync(path.join(dist, "map", dir, file)).size === 0) fail(`map/${dir}/${file} is empty`);
    }
  }
}

async function loadPrevious(src) {
  if (!src) return null;
  if (/^https?:/.test(src)) {
    const res = await fetch(src);
    if (res.status === 404) return null; // first publish
    if (!res.ok) throw new Error(`previous manifest: HTTP ${res.status}`);
    return res.json();
  }
  return JSON.parse(fs.readFileSync(src, "utf8"));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const dist = path.resolve(args.find((a) => !a.startsWith("--")) ?? "dist");
  const prevIdx = args.indexOf("--previous");
  const previous = await loadPrevious(prevIdx >= 0 ? args[prevIdx + 1] : null);
  const errors = await verify(dist, previous);
  if (errors.length) {
    console.error(`verify FAILED (${errors.length}):\n  ${errors.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`verify OK: ${dist}`);
}
