// Full pipeline: OpenRS2 cache → RuneLite renderer → dist/ in the published layout.
//
//   node scripts/build.mjs [--out dist] [--work .work]
//
// dist/
//   items/{id}.webp  skills/{skill}.png  slots/{slot}.png  data/stacks.json  manifest.json
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ALIAS_GROUPS, allSpriteIds } from "./aliases.mjs";
import { downloadCache } from "./fetch-cache.mjs";
import { generatorHash } from "./generator-hash.mjs";

sharp.cache(false);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? path.resolve(args[i + 1]) : path.resolve(root, fallback);
};
const outDir = arg("--out", "dist");
const workDir = arg("--work", ".work");
const rawDir = path.join(workDir, "raw");

// Run from the generator dir with a relative wrapper name: on Windows .bat files need a shell, and a
// shell would split an absolute path containing spaces.
const generatorDir = path.join(root, "generator");
function gradle(...gradleArgs) {
  const win = process.platform === "win32";
  return execFileSync(win ? ".\\gradlew.bat" : "./gradlew", gradleArgs, {
    cwd: generatorDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    shell: win,
  });
}

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

const started = Date.now();
const log = (msg) => console.log(`[${((Date.now() - started) / 1000).toFixed(0)}s] ${msg}`);

log("selecting + downloading cache");
const cache = await downloadCache(path.join(workDir, "cache"));
log(`cache openrs2=${cache.id} build=${cache.build} (${cache.timestamp})`);

log("rendering with the RuneLite cache library");
fs.rmSync(rawDir, { recursive: true, force: true });
gradle("-q", "installDist");
const runeliteCache = /runelite-cache=(\S+)/.exec(gradle("-q", "cacheVersion"))?.[1] ?? null;
const libDir = path.join(root, "generator", "build", "install", "osrs-icons-generator", "lib");
const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin", "java") : "java";
execFileSync(
  java,
  [
    "-Xmx4g",
    "-Djava.awt.headless=true",
    "-Dorg.slf4j.simpleLogger.defaultLogLevel=error",
    "-cp",
    path.join(libDir, "*"),
    "net.runelite.cache.IconDump",
    "--cache",
    cache.cacheDir,
    "--out",
    rawDir,
    "--sprites",
    allSpriteIds().join(","),
  ],
  { stdio: "inherit" },
);
const stats = JSON.parse(fs.readFileSync(path.join(rawDir, "stats.json"), "utf8"));

fs.rmSync(outDir, { recursive: true, force: true });
for (const dir of ["items", "data", ...Object.keys(ALIAS_GROUPS)]) {
  fs.mkdirSync(path.join(outDir, dir), { recursive: true });
}

const pngs = fs.readdirSync(path.join(rawDir, "items")).filter((f) => f.endsWith(".png"));
log(`encoding ${pngs.length} item icons to lossless WebP`);
let done = 0;
await mapLimit(pngs, os.availableParallelism(), async (file) => {
  await sharp(path.join(rawDir, "items", file))
    .webp({ lossless: true, effort: 6 })
    .toFile(path.join(outDir, "items", file.replace(/\.png$/, ".webp")));
  if (++done % 5000 === 0) log(`  ${done}/${pngs.length}`);
});

log("copying named sprites");
const aliasCounts = {};
for (const [group, table] of Object.entries(ALIAS_GROUPS)) {
  aliasCounts[group] = 0;
  for (const [name, spriteId] of Object.entries(table)) {
    const src = path.join(rawDir, "sprites", `${spriteId}.png`);
    if (!fs.existsSync(src)) continue; // verify.mjs reports missing aliases
    fs.copyFileSync(src, path.join(outDir, group, `${name}.png`));
    aliasCounts[group]++;
  }
}

const stacks = JSON.parse(fs.readFileSync(path.join(rawDir, "stacks.json"), "utf8"));
fs.writeFileSync(path.join(outDir, "data", "stacks.json"), JSON.stringify(stacks));

const manifest = {
  schema: 1,
  generatedAt: new Date().toISOString(),
  osrsBuild: cache.build,
  openrs2: { id: cache.id, timestamp: cache.timestamp },
  runeliteCache,
  generator: generatorHash(),
  counts: {
    items: pngs.length,
    noted: stats.noted,
    placeholders: stats.placeholders,
    ...aliasCounts,
    stacks: Object.keys(stacks).length,
  },
};
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
log(`done → ${outDir}`);
console.log(JSON.stringify(manifest, null, 2));
