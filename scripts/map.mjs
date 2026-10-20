// The world map: what MapTileDump and MapLabelDump wrote into raw/map, cut and shaped into the
// published layout.
//
//   map/tiles/{plane}_{x}_{y}.webp      256 px for 64 by 64 game tiles (4 px a tile), x and y in map
//                                       squares, y going north. Floors above the ground show the
//                                       floor below, darkened, where they have nothing of their own.
//   map/zoom/{level}/{plane}_{x}_{y}.webp  the same terrain shrunk: a tile of level n covers 2^n by 2^n
//                                       map tiles, for drawing the map far zoomed out.
//   map/labels/{hash}.webp              the image of one place name, named by its content.
//   map/icons/{hash}.webp               a sheet of the map's icons, 15 px each, side by side.
//   data/map.json                       which of these exist and where each icon and label goes.
//
// Labels and the icon sheet are named by their content because the cache numbers them by position:
// a new label in a game update shifts every number after it, and a browser holding yesterday's
// image under today's number would draw the wrong name. A tile's name is its place, which doesn't
// shift, so a tile is overwritten when the game redraws that place.
//
// The tiling follows group-ironmen's cache scripts (christoabrown/group-ironmen, BSD-2-Clause), and the
// zoom levels and major labels ha-osrs-map's scripts/generate-map-levels.js.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

export const TILE_SIZE = 256;
export const PLANES = 4;
export const LEVELS = [1, 2, 3];
export const ICON_SIZE = 15;
// The colours of the names of regions and of seas on the game's world map.
const REGION_COLOR = "255,152,31";
const SEA_COLOR = "29,224,224";

async function mapLimit(items, limit, fn) {
  let next = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

const hashOf = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);

/** Map tile names (`{plane}_{x}_{y}`) of a coarse level tile, each with its place and size in it. */
export function levelGroups(tiles, level) {
  const span = 2 ** level;
  const size = TILE_SIZE / span;
  const groups = new Map();
  for (const tile of tiles) {
    const [plane, x, y] = tile.split("_").map((part) => parseInt(part, 10));
    const name = `${plane}_${Math.floor(x / span)}_${Math.floor(y / span)}`;
    if (!groups.has(name)) groups.set(name, []);
    // y goes up on the map and down in the image.
    groups.get(name).push({ tile, left: (x % span) * size, top: (span - 1 - (y % span)) * size, size });
  }
  return groups;
}

/** The colour (`"r,g,b"`) most of an image's opaque pixels have, black aside; null when it has none. */
export function dominantColor(rgba) {
  const counts = new Map();
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 200) continue;
    const color = `${rgba[i]},${rgba[i + 1]},${rgba[i + 2]}`;
    if (color !== "0,0,0") counts.set(color, (counts.get(color) || 0) + 1);
  }
  let best = null;
  for (const [color, count] of counts) {
    if (best === null || count > counts.get(best)) best = color;
  }
  return best;
}

/** The indexes of the labels that name a region or a sea: regions first, then seas, largest first. */
export function majorLabelOrder(labels) {
  const rank = (label) => (label.color === REGION_COLOR ? 0 : 1);
  return labels
    .filter((label) => label.color === REGION_COLOR || label.color === SEA_COLOR)
    .sort((a, b) => rank(a) - rank(b) || b.width * b.height - a.width * a.height || a.id - b.id)
    .map((label) => label.id);
}

/**
 * Game positions keyed by the map square they are in, as the map looks them up:
 * `{regionX: {regionY: {key: [x, y, ...]}}}`. The y is one more than the game's, the site's coordinates.
 */
export function byRegion(entries) {
  const result = {};
  for (const { x, y: gameY, key, values } of entries) {
    const y = gameY + 1;
    const rx = Math.floor(x / 64);
    const ry = Math.floor(y / 64);
    result[rx] ??= {};
    result[rx][ry] ??= {};
    (result[rx][ry][key] ??= []).push(x, y, ...(values ?? []));
  }
  return result;
}

const lossless = (s) => s.flatten({ background: "#000000" }).webp({ lossless: true, alphaQuality: 0, effort: 6 });

async function cutPlane(rawDir, workDir, plane, bounds, tilesDir, made) {
  const dzDir = path.join(workDir, `plane-${plane}`);
  fs.rmSync(dzDir, { recursive: true, force: true });
  fs.mkdirSync(dzDir, { recursive: true });
  // Flipped so the tile rows count north, as map squares do; each tile is flipped back below.
  await sharp(path.join(rawDir, `img-${plane}.png`), { limitInputPixels: false })
    .flip()
    .webp({ lossless: true })
    .tile({ size: TILE_SIZE, depth: "one", background: { r: 0, g: 0, b: 0, alpha: 0 }, skipBlanks: 0 })
    .toFile(path.join(dzDir, "out.dz"));

  const cut = fs.readdirSync(path.join(dzDir, "out_files", "0")).filter((f) => f.endsWith(".webp"));
  await mapLimit(cut, os.availableParallelism(), async (file) => {
    const [x, y] = path.basename(file, ".webp").split("_").map((n) => parseInt(n, 10));
    const name = `${plane}_${x + bounds.regionX}_${y + bounds.regionY}`;
    const tile = await sharp(path.join(dzDir, "out_files", "0", file)).flip().png().toBuffer();
    const below = path.join(tilesDir, `${plane - 1}_${x + bounds.regionX}_${y + bounds.regionY}.webp`);
    const image =
      plane > 0 && made.has(path.basename(below, ".webp"))
        ? sharp(await sharp(below).linear(0.5).png().toBuffer()).composite([{ input: tile }])
        : sharp(tile);
    await lossless(image).toFile(path.join(tilesDir, `${name}.webp`));
    made.add(name);
  });
  fs.rmSync(dzDir, { recursive: true, force: true });

  // A floor shows the floor below, darkened, where it has nothing of its own.
  if (plane > 0) {
    const missing = [...made]
      .filter((name) => name.startsWith(`${plane - 1}_`))
      .map((name) => name.replace(/^\d+_/, `${plane}_`))
      .filter((name) => !made.has(name));
    await mapLimit(missing, os.availableParallelism(), async (name) => {
      const below = path.join(tilesDir, `${plane - 1}_${name.slice(2)}.webp`);
      await lossless(sharp(below).linear(0.5)).toFile(path.join(tilesDir, `${name}.webp`));
    });
    for (const name of missing) made.add(name);
  }
}

async function writeLevels(tilesDir, zoomDir, tiles) {
  const counts = {};
  for (const level of LEVELS) {
    const dir = path.join(zoomDir, String(level));
    fs.mkdirSync(dir, { recursive: true });
    const groups = [...levelGroups(tiles, level)];
    await mapLimit(groups, os.availableParallelism(), async ([name, parts]) => {
      const pieces = await Promise.all(
        parts.map(async ({ tile, left, top, size }) => ({
          input: await sharp(path.join(tilesDir, `${tile}.webp`))
            .resize(size, size, { kernel: "mitchell" })
            .png()
            .toBuffer(),
          left,
          top,
        })),
      );
      await sharp({
        create: { width: TILE_SIZE, height: TILE_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      })
        .composite(pieces)
        .webp({ quality: 85, effort: 6 })
        .toFile(path.join(dir, `${name}.webp`));
    });
    counts[level] = groups.map(([name]) => name);
  }
  return counts;
}

/** Per floor, the `{x}_{y}` of each tile name. */
function perFloor(names) {
  const floors = Array.from({ length: PLANES }, () => []);
  for (const name of [...names].sort()) {
    const [plane, x, y] = name.split("_");
    floors[parseInt(plane, 10)].push(`${x}_${y}`);
  }
  return floors;
}

async function writeIcons(rawDir, iconsDir) {
  const sprites = fs
    .readdirSync(path.join(rawDir, "icons"))
    .filter((f) => f.endsWith(".png"))
    .map((f) => parseInt(f, 10))
    .sort((a, b) => a - b);
  const index = new Map(sprites.map((id, i) => [String(id), i]));
  const sheet = await sharp({
    create: { width: ICON_SIZE * sprites.length, height: ICON_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(sprites.map((id, i) => ({ input: path.join(rawDir, "icons", `${id}.png`), left: ICON_SIZE * i, top: 0 })))
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
  const sheetName = `${hashOf(sheet)}.webp`;
  fs.writeFileSync(path.join(iconsDir, sheetName), sheet);

  const positions = JSON.parse(fs.readFileSync(path.join(rawDir, "icons", "map-icons.json"), "utf8"));
  const entries = [];
  for (const [spriteId, coords] of Object.entries(positions)) {
    const key = index.get(spriteId);
    if (key === undefined) throw new Error(`map icon ${spriteId} has no image`);
    for (let i = 0; i < coords.length; i += 3) entries.push({ x: coords[i], y: coords[i + 1], key, values: [coords[i + 2]] });
  }
  return { sheet: `icons/${sheetName}`, size: ICON_SIZE, count: sprites.length, at: byRegion(entries) };
}

async function writeLabels(rawDir, labelsDir) {
  const placed = JSON.parse(fs.readFileSync(path.join(rawDir, "labels", "map-labels.json"), "utf8"));
  const files = [];
  const measured = [];
  await mapLimit(
    placed.map((_, i) => i),
    os.availableParallelism(),
    async (i) => {
      const png = path.join(rawDir, "labels", `${i}.png`);
      const webp = await sharp(png).webp({ lossless: true, effort: 6 }).toBuffer();
      const name = hashOf(webp);
      fs.writeFileSync(path.join(labelsDir, `${name}.webp`), webp);
      files[i] = name;
      const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      measured[i] = { id: i, width: info.width, height: info.height, color: dominantColor(data) };
    },
  );
  // The plane is the key, the label's index follows its position.
  const at = byRegion(placed.map(([x, y, z], i) => ({ x, y, key: z, values: [i] })));
  return { files, at, major: majorLabelOrder(measured) };
}

/**
 * Builds map/ and data/map.json in `outDir` from the dumpers' output in `rawDir`. Returns the counts
 * for the manifest.
 */
export async function buildMap(rawDir, outDir, workDir, log = () => {}) {
  const mapDir = path.join(outDir, "map");
  const tilesDir = path.join(mapDir, "tiles");
  const iconsDir = path.join(mapDir, "icons");
  const labelsDir = path.join(mapDir, "labels");
  for (const dir of [tilesDir, iconsDir, labelsDir]) fs.mkdirSync(dir, { recursive: true });

  const bounds = JSON.parse(fs.readFileSync(path.join(rawDir, "bounds.json"), "utf8"));
  const made = new Set();
  for (let plane = 0; plane < PLANES; plane++) {
    log(`cutting map floor ${plane}`);
    await cutPlane(rawDir, workDir, plane, bounds, tilesDir, made);
  }
  log(`making the zoomed-out levels of ${made.size} map tiles`);
  const levelTiles = await writeLevels(tilesDir, path.join(mapDir, "zoom"), [...made]);
  log("writing the map's icons and labels");
  const icons = await writeIcons(rawDir, iconsDir);
  const labels = await writeLabels(rawDir, labelsDir);

  const map = {
    schema: 1,
    tileSize: TILE_SIZE,
    tiles: perFloor(made),
    levels: Object.fromEntries(Object.entries(levelTiles).map(([level, names]) => [level, perFloor(names)])),
    icons: { sheet: icons.sheet, size: icons.size, at: icons.at },
    labels,
  };
  fs.mkdirSync(path.join(outDir, "data"), { recursive: true });
  fs.writeFileSync(path.join(outDir, "data", "map.json"), JSON.stringify(map));
  return {
    mapTiles: made.size,
    mapLevelTiles: Object.values(levelTiles).reduce((n, names) => n + names.length, 0),
    mapIcons: icons.count,
    mapLabels: labels.files.length,
    mapMajorLabels: labels.major.length,
  };
}
