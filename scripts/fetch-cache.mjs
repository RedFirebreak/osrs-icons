// Picks the newest complete OSRS cache from the OpenRS2 archive and (optionally) downloads it.
//
//   node scripts/fetch-cache.mjs --select-only        prints {"id", "build", "timestamp"} as JSON
//   node scripts/fetch-cache.mjs --dir .work/cache    downloads + extracts, prints the same JSON
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import unzipper from "unzipper";

const ARCHIVE = "https://archive.openrs2.org";

// OpenRS2 publishes a cache as soon as it starts archiving it. A fresh entry can report 100% valid
// groups while only holding a fraction of them (seen: 7,006 groups vs ~117k), so we also require the
// group count to be close to the largest one among recent caches.
const COMPLETENESS_WINDOW = 10;
const COMPLETENESS_RATIO = 0.98;

export function selectCache(caches) {
  const live = caches
    .filter(
      (c) =>
        c.scope === "runescape" &&
        c.game === "oldschool" &&
        c.environment === "live" &&
        (c.language ?? "en") === "en" &&
        c.timestamp &&
        !c.hidden,
    )
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const recentMaxGroups = Math.max(0, ...live.slice(0, COMPLETENESS_WINDOW).map((c) => c.groups ?? 0));

  const cache = live.find(
    (c) =>
      c.disk_store_valid !== false &&
      c.valid_indexes === c.indexes &&
      c.valid_groups === c.groups &&
      c.groups >= recentMaxGroups * COMPLETENESS_RATIO,
  );
  if (!cache) {
    throw new Error("No complete live oldschool cache found in the OpenRS2 archive");
  }
  return {
    id: cache.id,
    build: cache.builds?.[0]?.major ?? null,
    timestamp: cache.timestamp,
  };
}

export async function fetchCacheList() {
  const res = await fetch(`${ARCHIVE}/caches.json`);
  if (!res.ok) throw new Error(`caches.json: HTTP ${res.status}`);
  return res.json();
}

// Downloads and extracts the cache into `dir`. Returns the selection plus the directory that holds
// main_file_cache.dat2. Reuses an existing extraction of the same cache id.
export async function downloadCache(dir) {
  const selected = selectCache(await fetchCacheList());
  const marker = path.join(dir, "openrs2.json");
  const cacheDir = path.join(dir, "cache");

  if (fs.existsSync(marker) && JSON.parse(fs.readFileSync(marker, "utf8")).id === selected.id) {
    console.error(`cache ${selected.id} already present in ${dir}`);
    return { ...selected, cacheDir };
  }

  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const zipPath = path.join(dir, "disk.zip");
  const url = `${ARCHIVE}/caches/runescape/${selected.id}/disk.zip`;
  console.error(`downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`disk.zip: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(zipPath));

  const zip = await unzipper.Open.file(zipPath);
  await zip.extract({ path: dir });
  fs.rmSync(zipPath);

  if (!fs.existsSync(path.join(cacheDir, "main_file_cache.dat2"))) {
    throw new Error(`Extracted cache has no ${cacheDir}/main_file_cache.dat2`);
  }
  fs.writeFileSync(marker, JSON.stringify(selected));
  return { ...selected, cacheDir };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.includes("--select-only")) {
    console.log(JSON.stringify(selectCache(await fetchCacheList())));
  } else {
    const dirIdx = args.indexOf("--dir");
    const dir = dirIdx >= 0 ? args[dirIdx + 1] : ".work/cache";
    const { cacheDir, ...selected } = await downloadCache(dir);
    console.log(JSON.stringify(selected));
  }
}
