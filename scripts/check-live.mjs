// Decides whether a publish is needed: the newest complete cache or the generator differ from what
// the live manifest says was published. Also reports `stale` when a newer game build has been listed
// for days without us publishing it; the workflow fails on that at the end of the run.
//
//   node scripts/check-live.mjs https://icons.scapekeeper.com   → prints JSON, sets GitHub outputs
import fs from "node:fs";
import { fetchCacheList, selectCache, staleness } from "./fetch-cache.mjs";
import { generatorHash } from "./generator-hash.mjs";

const base = (process.argv[2] ?? "https://icons.scapekeeper.com").replace(/\/+$/, "");

const caches = await fetchCacheList();
const cache = selectCache(caches);
const generator = generatorHash();

let live = null;
const res = await fetch(`${base}/manifest.json`, { cache: "no-store" });
if (res.ok) live = await res.json();
else if (res.status !== 404) throw new Error(`live manifest: HTTP ${res.status}`);

const reasons = [];
if (!live) reasons.push("nothing published yet");
else {
  if (live.openrs2?.id !== cache.id) reasons.push(`cache ${live.openrs2?.id} → ${cache.id}`);
  if (live.generator !== generator) reasons.push(`generator ${live.generator} → ${generator}`);
}

const publish = reasons.length > 0;
// The build that will be live after this run.
const stale = staleness(caches, publish ? cache.build : live?.osrsBuild);

const result = { publish, reasons, stale, cache, generator, live: live && { openrs2: live.openrs2, osrsBuild: live.osrsBuild, generator: live.generator } };
console.log(JSON.stringify(result, null, 2));

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `publish=${result.publish}\nopenrs2=${cache.id}\nbuild=${cache.build}\nreason=${reasons.join("; ") || "up to date"}\nstale=${stale ?? ""}\n`,
  );
}
