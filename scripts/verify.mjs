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
// A new cache only ever adds items; a big drop means a partial or broken cache.
const MAX_ITEM_DROP = 0.02;
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

  return errors;
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
