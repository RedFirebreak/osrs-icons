import assert from "node:assert/strict";
import { test } from "node:test";
import { selectCache } from "../scripts/fetch-cache.mjs";

const cache = (id, timestamp, groups, extra = {}) => ({
  id,
  scope: "runescape",
  game: "oldschool",
  environment: "live",
  language: "en",
  builds: [{ major: 200 + id, minor: null }],
  timestamp,
  indexes: 25,
  valid_indexes: 25,
  groups,
  valid_groups: groups,
  disk_store_valid: true,
  hidden: false,
  ...extra,
});

test("picks the newest complete live oldschool cache", () => {
  const selected = selectCache([
    cache(1, "2026-09-16T10:00:00Z", 117455),
    cache(2, "2026-09-23T14:00:00Z", 117560),
  ]);
  assert.deepEqual(selected, { id: 2, build: 202, timestamp: "2026-09-23T14:00:00Z" });
});

test("skips a cache that is still being archived (few groups, all valid)", () => {
  const selected = selectCache([
    cache(2, "2026-09-23T14:00:00Z", 117560),
    cache(3, "2026-09-30T12:30:00Z", 7006),
  ]);
  assert.equal(selected.id, 2);
});

test("skips caches with invalid groups or indexes, other games and hidden entries", () => {
  const selected = selectCache([
    cache(1, "2026-09-01T00:00:00Z", 117000),
    cache(2, "2026-09-02T00:00:00Z", 117000, { valid_groups: 116000 }),
    cache(3, "2026-09-03T00:00:00Z", 117000, { valid_indexes: 24 }),
    cache(4, "2026-09-04T00:00:00Z", 117000, { game: "runescape" }),
    cache(5, "2026-09-05T00:00:00Z", 117000, { environment: "beta" }),
    cache(6, "2026-09-06T00:00:00Z", 117000, { hidden: true }),
  ]);
  assert.equal(selected.id, 1);
});

test("throws when nothing qualifies", () => {
  assert.throws(() => selectCache([]), /No complete live oldschool cache/);
});
