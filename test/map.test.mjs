import assert from "node:assert/strict";
import { test } from "node:test";
import { byRegion, dominantColor, levelGroups, majorLabelOrder } from "../scripts/map.mjs";
import { toRuneliteXteas } from "../scripts/fetch-cache.mjs";

test("a level tile gathers the map tiles it covers, north at the top", () => {
  const groups = levelGroups(["0_50_50", "0_51_50", "0_50_51", "1_50_50"], 1);
  assert.deepEqual([...groups.keys()].sort(), ["0_25_25", "1_25_25"]);
  assert.deepEqual(groups.get("0_25_25"), [
    { tile: "0_50_50", left: 0, top: 128, size: 128 },
    { tile: "0_51_50", left: 128, top: 128, size: 128 },
    { tile: "0_50_51", left: 0, top: 0, size: 128 },
  ]);
});

test("positions are keyed by map square, one tile north of the game's", () => {
  const at = byRegion([
    { x: 3222, y: 3218, key: 4 },
    { x: 3223, y: 3219, key: 4 },
    { x: 3200, y: 3263, key: 0, values: [7] },
  ]);
  assert.deepEqual(at, { 50: { 50: { 4: [3222, 3219, 3223, 3220] }, 51: { 0: [3200, 3264, 7] } } });
});

test("a label's colour is that of most of its opaque pixels, black outline aside", () => {
  const px = (r, g, b, a = 255) => [r, g, b, a];
  const rgba = Uint8Array.from([...px(0, 0, 0), ...px(255, 152, 31), ...px(255, 152, 31), ...px(1, 2, 3), ...px(9, 9, 9, 0)]);
  assert.equal(dominantColor(rgba), "255,152,31");
  assert.equal(dominantColor(Uint8Array.from(px(0, 0, 0))), null);
});

test("major labels: regions before seas, larger first, the rest left out", () => {
  const order = majorLabelOrder([
    { id: 1, width: 10, height: 10, color: "29,224,224" },
    { id: 2, width: 10, height: 10, color: "255,152,31" },
    { id: 3, width: 50, height: 10, color: "255,152,31" },
    { id: 4, width: 90, height: 90, color: "255,255,255" },
  ]);
  assert.deepEqual(order, [3, 2, 1]);
});

test("OpenRS2 keys become RuneLite's XTEA format", () => {
  assert.deepEqual(toRuneliteXteas([{ archive: 5, group: 1, mapsquare: 12850, key: [1, 2, 3, 4] }]), [
    { region: 12850, keys: [1, 2, 3, 4] },
  ]);
});
