import assert from "node:assert/strict";
import { test } from "node:test";
import {
  iconsBase,
  itemIconUrl,
  skillIconUrl,
  slotIconUrl,
  stackedItemId,
} from "../clients/osrs-icons.mjs";

const stacks = {
  995: [[2, 996], [3, 997], [4, 998], [5, 999], [25, 1000], [100, 1001], [250, 1002], [1000, 1003], [10000, 1004]],
};
const base = "https://icons.example";

test("stack variants follow the highest breakpoint <= quantity", () => {
  assert.equal(stackedItemId(stacks, 995, 1), 995);
  assert.equal(stackedItemId(stacks, 995, 2), 996);
  assert.equal(stackedItemId(stacks, 995, 24), 999);
  assert.equal(stackedItemId(stacks, 995, 9999), 1003);
  assert.equal(stackedItemId(stacks, 995, 10000), 1004);
  assert.equal(stackedItemId(stacks, 995, 2_147_483_647), 1004);
  assert.equal(stackedItemId(stacks, 4151, 5), 4151);
  assert.equal(stackedItemId({}, 995, 5), 995);
});

test("base URL handling", () => {
  assert.equal(iconsBase("https://icons.example/"), base);
  assert.equal(iconsBase(" https://icons.example// "), base);
  assert.equal(iconsBase(""), null);
  assert.equal(iconsBase(undefined), "https://icons.scapekeeper.com");
});

test("URLs", () => {
  assert.equal(itemIconUrl(base, stacks, 995, 100), `${base}/items/1001.webp`);
  assert.equal(itemIconUrl(base, stacks, 4152), `${base}/items/4152.webp`);
  assert.equal(itemIconUrl(null, stacks, 4151), null);
  assert.equal(itemIconUrl(base, stacks, -1), null);
  assert.equal(skillIconUrl(base, "Attack"), `${base}/skills/attack.png`);
  assert.equal(skillIconUrl(base, "Overall"), null);
  assert.equal(slotIconUrl(base, "AMULET"), `${base}/slots/amulet.png`);
});
