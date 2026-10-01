// A content hash of everything that shapes the published files. A change here forces a republish even
// when the game cache is unchanged. Scripts that only decide or check (check-live, verify, this file)
// are left out on purpose. Line endings are normalised so Windows checkouts hash like CI.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INPUTS = [
  "generator/build.gradle.kts",
  "generator/settings.gradle.kts",
  "generator/gradle/wrapper/gradle-wrapper.properties",
  "generator/src",
  "scripts/build.mjs",
  "scripts/aliases.mjs",
  "scripts/collections.mjs",
  "package-lock.json",
];

function listFiles(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return [rel];
  return fs
    .readdirSync(abs)
    .flatMap((name) => listFiles(path.posix.join(rel, name)));
}

export function generatorHash() {
  const hash = crypto.createHash("sha256");
  for (const rel of INPUTS.flatMap(listFiles).sort()) {
    hash.update(rel + "\0");
    hash.update(fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n"));
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 16);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(generatorHash());
}
