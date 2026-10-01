# Central OSRS icon source: `osrs-icons` → icons.scapekeeper.com

## Context
Three projects want OSRS game icons (items, skills, equipment slots):
- The map bundles about 115 MB of committed assets.
- The hub has none. `item-tile.tsx` says "No item images: the hub has no icon source", and `HANDOFF-draft2.md` §18 lists this as open point #2.
- HA sets no `entity_picture` anywhere.

The map's icons came from upstream group-ironmen's cache generator. Upstream deleted it from the public repo in `c20e816f6` and now only merges weekly "chore: update cache outputs" PRs. So nobody on our side can regenerate them.

Upstream also never rendered **noted or placeholder** ids. The RuneLite plugin sends raw container ids, so noted items show no icon today.

**Goal:** one generated, id-keyed icon set, rebuilt automatically after game updates, served from a CDN, and used by the hub, HA, the map and future projects through a small, stable URL contract.

**Decisions (from the user):**
- The source is the game cache: OpenRS2 plus the RuneLite cache library. Not the wiki.
- Hosting is Cloudflare R2 behind `icons.scapekeeper.com`, which is already on Cloudflare. Pages is out because of its 20k-files limit.
- Every consumer hotlinks the CDN by default, with a **configurable base URL**. A versioned tarball is published as a GitHub Release for self-hosting.
- The map moves its icons to the CDN and deletes the committed item icons. Map tiles and labels stay in the map repo.
- No bot opening PRs into consumer repos.

---

## Phase 1: new public repo `RedFirebreak/osrs-icons`

It must be public: that gets the free 4-CPU/16 GB runner, and the release tarballs need to be public anyway.

```
osrs-icons/
  README.md  NOTICE  LICENSE (BSD-2)   URL contract, resolver snippets (JS+Python), self-hosting, licensing
  docs/superpowers/specs/2026-09-30-osrs-icons-design.md   (this design, committed)
  package.json / package-lock.json     sharp (pinned), unzipper
  generator/  Gradle (Kotlin DSL + wrapper), Java 17
    build.gradle.kts   repos mavenCentral + https://repo.runelite.net; net.runelite:cache:latest.release; -Xmx4g
    src/main/java/net/runelite/cache/IconDump.java
    src/main/java/net/runelite/cache/item/IconItemSpriteFactory.java
  scripts/ fetch-cache.mjs  build.mjs  verify.mjs  aliases.mjs
  .github/workflows/publish.yml
```

**Porting the old generator:**
- Recover upstream's sources with `git -C ha-osrs-map show c20e816f6^:cache/<file>` for `ItemSpriteFactory.java`, `Cache.java` and `update.js`.
- `ItemSpriteFactory` already renders the note/placeholder overlay when it is given a noted or placeholder id. So we simply render **every** id and need no mapping.
- The factory is copied verbatim, keeping its BSD header, and renamed to `IconItemSpriteFactory`.
- `net.runelite:cache` is on repo.runelite.net, so there's no need to clone runelite/runelite or use a Gradle init script.

**`IconDump.java`** (single-threaded; the rasterizer isn't thread-safe) does three things:
1. It renders all item definitions with `createSprite(id, 1, border=1, shadow=0x111111, noted=false)`, the same parameters as upstream, so the output is pixel-identical. It writes `items-png/{id}.png`, skipping null or fully transparent results.
2. It writes `stacks.json` from `countObj`/`countCo`: `{"995":[[2,996],…,[10000,1004]]}`.
3. It exports sprites via `SpriteManager`.

**`fetch-cache.mjs`:**
- Picks the newest cache from `archive.openrs2.org/caches.json` with `game=oldschool`, `environment=live` and `language=en`, where valid indexes equal indexes and valid groups equal groups.
- Items and sprites need no XTEA keys, so key coverage isn't checked.
- `--select-only` prints `{id, build}`.

**`build.mjs`:** fetches the cache, runs Gradle, converts the PNGs with sharp to lossless WebP (effort 6), copies the aliases and writes the data files.

### URL contract (stable paths, never deleted)
| Path | Content |
|---|---|
| `/items/{id}.webp` | 72×64, displayed at 36×32. Covers base, noted, placeholder, bought and stack-variant ids. |
| `/skills/{slug}.png` | Lowercase skill names (attack … sailing), sprites 197–217, 220, 221, 228, as in the map's `skill.js` |
| `/slots/{slot}.png` | head cape amulet weapon ring body shield legs gloves boots ammo (sprites 156–166). Lowercased RuneLite `EquipmentInventorySlot` names. |
| `/data/stacks.json` | About 356 stack tables |
| `/manifest.json` | `{schema, generatedAt, osrsBuild, openrs2:{id,timestamp}, runeliteCache, generator, counts}` |

**Resolver (the whole contract):** if `stacks[id]` exists, use the variant with the highest breakpoint that is ≤ the quantity; otherwise use the id itself. The URL is `${base}/items/${id}.webp`. A 404 means "no icon", and consumers fall back to text.

### Cloudflare setup (one-time, manual, documented in the README)
- An R2 bucket `osrs-icons` with custom domain `icons.scapekeeper.com`, and r2.dev turned off.
- A bucket-scoped R/W token stored as secrets `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`.
- A Transform Rule that sets `Access-Control-Allow-Origin: *`. R2's own CORS only answers requests carrying `Origin`, which breaks with cached responses.
- A Cache Rule: eligible for cache and respect origin headers.
- No Worker and no hotlink protection.

### `publish.yml`
**Triggers:** cron on Wednesday at 21:00 (the evening of the game update) and Sunday at 12:00, both Europe/Amsterdam, plus `workflow_dispatch` with `force` and `dry_run`. `concurrency: publish`, `contents: write`.

**Steps:**
1. **Skip check:** run `fetch-cache --select-only`, compute the generator hash (tree hash of `generator/` + `scripts/` + the lockfile), and fetch the live `manifest.json`. If nothing has changed, exit early.
2. **Setup:** setup-java 17, setup-gradle (cached), setup-node 22, `npm ci`.
3. **Build:** `node scripts/build.mjs --out dist`.
4. **Verify** (`verify.mjs`) must pass:
   - at least 28k items rendered;
   - ids 995, 996–1004, 4151, 4152 (noted), a placeholder id and 13190 are all present;
   - every skill and slot alias exists;
   - at least 300 stacks, and every stack target has an image;
   - no zero-byte files.
5. **`dry_run`:** upload `dist` as a workflow artifact and stop.
6. **Upload** with `rclone copy --checksum` (pinned rclone, s3 provider Cloudflare), in this order: items → skills/slots → stacks.json → **manifest.json last**.
   - Images get `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`.
   - JSON gets `max-age=300`.
   - Use `copy`, never `sync`: files are never deleted.
7. **Release:** `gh release create rev{build}-{openrs2id}` with `osrs-icons-….tar.gz`, which has the same layout as the bucket.

**Gotcha to document:** changing Cache-Control later needs `--ignore-checksum` to force a re-upload.

---

## Phase 2: osrs-data-hub (Next.js 16, prebuilt GHCR images)

**New files:**
- `apps/web/src/lib/osrs-icons.ts` with pure helpers `itemIconUrl`, `skillIconUrl` (null for Overall) and `slotIconUrl`.
- `getIconConfig()` in that file, server-only:
  - reads `process.env.OSRS_ICONS_URL` at runtime (not `NEXT_PUBLIC_`, which would be baked into the prebuilt image), with an empty value turning icons off;
  - fetches `stacks.json` with `revalidate: 86400`, falling back to `{}`.
- `apps/web/src/components/icons/icon-config-provider.tsx`, a client context.
- `item-icon.tsx` and `game-sprite.tsx`:
  - plain `<img loading="lazy">` at 36×32, not `next/image`;
  - `onError` hides the image so the text remains;
  - `image-rendering: pixelated` when scaled up.

**Wiring:** put the provider in `app/layout.tsx`. If the build route table shows static routes turning dynamic, move it into the dynamic segment layouts instead.

**Component changes:**
- `components/account/item-tile.tsx`: icon with an in-game quantity overlay; the name moves to `title`/`sr-only`.
- `equipment-content.tsx`: empty slots show the slot silhouette.
- `skills-table.tsx`: skill icon per row.
- `events/event-icon.tsx`, `account/event-timeline.tsx`, `live/event-toast.tsx`: item icon when `itemId` is set.

**Docs:**
- `.env.example`: add `OSRS_ICONS_URL`.
- Decision D-95.
- Close item #2 in `HANDOFF-draft2.md` §18.
- `ARCHITECTURE.md` (the icon note around line 276).
- A new gotcha: `docs/gotchas/runtime-env-in-standalone.md`.

**Verify:**
- lint, typecheck and Vitest resolver tests: coins with quantity 1→995, 2→996, 9999→1003, 10000→1004; an unknown id returns itself; a trailing slash is stripped; an empty base gives no icon.
- Run the **prebuilt** image with `OSRS_ICONS_URL` pointing at a locally served tarball, and confirm the requests go there without a rebuild.
- A Playwright spot check of the account page.

## Phase 3: ha-osrs-data (Python HA integration)

**New and changed files:**
- `const.py`: `CONF_ICONS_BASE_URL`, `DEFAULT_ICONS_BASE_URL`, `SKILL_SLUGS`.
- New `icons.py` with `IconResolver` (`item_url`, `skill_url`, `slot_url`, `async_refresh`):
  - fetches `stacks.json` through `async_get_clientsession`;
  - keeps the old stacks if a refresh fails;
  - returns `None` when the base is empty.
- `__init__.py`:
  - create the resolver in `hass.data[DOMAIN]`;
  - refresh it in a background task (so setup isn't blocked) and again every 24 h;
  - reload on options change.
- `config_flow.py` settings step: an optional base URL field (empty turns icons off), plus `strings.json` and translations.

**`sensor.py`** (icons are computed when attributes are built; the parser stays untouched):
- Skill `OsrsAccountDetailSensor` (around lines 895–931) gets `entity_picture`.
- Inventory (216–247) and Last Loot (755–807) items get an `icon` key.
- Equipment slots (479–509) get an `icon` key.
- Last Collection Log (826–865) gets `entity_picture`.

**Dashboards:** in `implementation/dashboards/osrs-progress.yaml` (gear markdown around line 243) and `osrs-overview.yaml`, show `<img src="{{ item.icon }}">`.

**Verify:**
- `pytest`, including a new `tests/test_icons.py`.
- On a dev HA instance: skill entities show pictures, changing the base URL updates every URL, and the dashboard renders gear images.

## Phase 4: ha-osrs-map (vanilla JS + express)

**Config:**
- `site/scripts/server.js` `injectConfig()`: add `iconsBaseUrl` from `ICONS_BASE_URL`, defaulting to the CDN.
- New `site/src/data/icons.js`: `itemIconUrl`, `skillIconUrl`, `slotIconUrl`, reading `window.siteConfig.iconsBaseUrl`.

**Call sites:**
- `site/src/data/item.js:26`: `itemIconUrl(imageId)`. The stack logic stays and still reads `item_data.json`.
- `event-feed/event-feed.js:24`, `clan-page/clan-page.js:273`, `player-profile-view/player-profile-view.js:431`: use `itemIconUrl`.
- `data/skill.js:50-99`: `skillIconUrl`. Keep the `/ui/3579-0.png` fallback.
- `player-equipment/player-equipment.js:21-31,78`: map the map's slot names to slot slugs.

**Deletions:**
- `site/public/icons/items/` (about 60 MB).
- The skill and slot `/ui/*-0.png` files, after grepping for other references.
- Keep everything `build.js` inlines, plus the rest of `/ui`, tiles and labels.

**Tests and docs:**
- `site/test/cache-data.test.js`: drop the local-icon checks and assert that `icons/items` does **not** exist, which guards against upstream merges re-adding them.
- README (lines 174–185): when merging upstream cache PRs, resolve modify/delete on `icons/items` as deleted (`git rm -rq --ignore-unmatch site/public/icons/items`). Document `ICONS_BASE_URL`.

**Verify:**
- `npm test` and `npm run build`.
- Run with `ICONS_BASE_URL` pointing at a local mirror; the network tab should show only the mirror.
- Visual check of inventory, equipment (empty and filled), skills, the event feed and the clan page.
- The Docker image should be about 60 MB smaller.

---

## Licensing (NOTICE)
- Images come from the OSRS cache, © Jagex Ltd, provided for non-commercial fan tools. We claim no ownership, and the NOTICE includes a takedown contact.
- Code is BSD-2. `IconItemSpriteFactory` is derived from RuneLite (BSD-2, © Adam) and keeps its header.
- Cache data comes from the OpenRS2 Archive.
- The rendering approach is credited to christoabrown/group-ironmen.

## Verification for Phase 1 (end to end)
1. **Local:** `node scripts/build.mjs`, then a one-off script that pixel-diffs all 19,882 existing map icons against `dist/items`. They should be identical, apart from items that changed since that cache. Look at 4152 (noted), a placeholder and a bought item by eye.
2. **CI:** a `dry_run` dispatch, inspect the artifact, then a real run.
3. **Live:** `curl -sI https://icons.scapekeeper.com/items/4151.webp` should show 200, `image/webp`, the Cache-Control header, `access-control-allow-origin: *`, and HIT on the second request. `/items/999999.webp` should return 404.
4. **Rerun:** the workflow should skip. Run with `force`: rclone should report 0 transfers (deterministic output), and the Release should exist.

**Order:** Phase 1 first. Phases 2 and 3 can then run in parallel, and Phase 4 is last. Each consumer repo gets its own branch and PR.

**Main risk:** a cache format change can break `net.runelite:cache` until RuneLite ships an update. The verify gate turns that into a failed run with a stale but working CDN, never a broken one.

---

## Findings during Phase 1 implementation (2026-09-30)

- **Render settings differ from upstream's deleted script.** The map's committed icons were made by
  upstream's newer, unpublished generator:
  - shadow `0x302020` (the in-game `DEFAULT_SHADOW_COLOR`), not `0x111111`;
  - zoom exactly `zoom2d / 2` (a true 2× render), not `/ 1.95`;
  - oversized models shrunk to fit the frame.

  With those settings, 18,520 of 19,882 existing icons (93%) come out pixel-identical. The rest
  differ only slightly: the fit step and texture details. The 228 icons we don't emit were fully
  transparent in the map.
- **Fit rule:** zoom out in 2% steps while any pixel lands *outside* the 72×64 frame, measured in a
  padded probe buffer. Touching an edge is allowed. This replaces the hard-coded holy-symbol hack.
  Fitting on edge contact instead shrank too many icons.
- **OpenRS2 lists caches before they're complete.** Cache 2727 (build 241) reported 25/25 indexes
  and 7,006/7,006 groups valid, against about 117k groups normally. `fetch-cache` now also requires
  the group count to be within 2% of the maximum over the 10 most recent caches. `verify` also
  rejects an item-count drop of more than 2% against the live manifest.
- **Output (cache 2720, build 240):** 34,369 item icons, including 4,717 noted and 9,971 placeholders;
  356 stack tables; 24 skills and 11 slots. About 110 MB. The full build takes about 4–5 minutes
  locally.
- `ItemManager.link()` is called so noted, placeholder and bought ids get their template's model.
- The JDK is 21 (Temurin) and `net.runelite:cache` resolves to 1.13.1.
