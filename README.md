# osrs-icons

Old School RuneScape item, skill and equipment-slot icons, rendered from the game cache and served
from **https://icons.scapekeeper.com**. It is the shared icon source for
[osrs-data-hub](https://github.com/RedFirebreak/osrs-data-hub),
[ha-osrs-data](https://github.com/RedFirebreak/ha-osrs-data) and
[ha-osrs-map](https://github.com/RedFirebreak/ha-osrs-map).

A scheduled workflow picks up each game update, re-renders, and uploads only what changed.
Consumers link to stable URLs. Nothing is committed into consumer repos.

## URL contract

Paths are stable and **never deleted**. New ids are only ever added.

| Path | What |
|---|---|
| `/items/{id}.webp` | Item icon, 72×64 (2× the in-game 36×32), lossless. Covers every renderable id: normal, **noted**, **placeholder**, bought and stack variants (e.g. coins `995`–`1004`). |
| `/skills/{skill}.png` | Skill icon. `{skill}` is the lowercase skill name: `attack` … `sailing`. There is no icon for "overall". |
| `/slots/{slot}.png` | Empty equipment-slot silhouette. `{slot}` is RuneLite's `EquipmentInventorySlot` in lowercase: `head cape amulet weapon body shield legs gloves boots ring ammo`. |
| `/data/stacks.json` | Stack tables: `{"995": [[2, 996], [3, 997], …, [10000, 1004]]}`. Each entry is a quantity breakpoint and the variant item id, sorted by breakpoint. |
| `/data/items.json` | Every named item that has an icon, with its game data. See [Data collections](#data-collections). |
| `/data/noted.json` | `{"4152": 4151}`: noted id → the item it is a note of. |
| `/data/placeholders.json` | `{"14032": 4151}`: bank placeholder id → the item it stands in for. |
| `/data/equipment.json` | Slot and bonuses of every wearable item in `items.json`. |
| `/data/skills.json`, `/data/slots.json` | The valid `{skill}` and `{slot}` names, as arrays. |
| `/manifest.json` | What is live: `osrsBuild`, `openrs2.{id,timestamp}`, `runeliteCache`, `generator`, `generatedAt`, `counts`. |

Every response has `Access-Control-Allow-Origin: *`. Images are cached for a day (`max-age=86400`,
`stale-while-revalidate` a week). The JSON files are cached for 5 minutes.

A **404 means "no icon"**. Some ids have no inventory model. Show the item name instead.

### Resolving an item icon

1. If `stacks[id]` exists, use the variant with the highest breakpoint that is ≤ the quantity.
   Otherwise use `id`.
2. `GET {base}/items/{that id}.webp`.

That is the whole contract. Fetch `stacks.json` once and cache it for a day. Two reference
implementations (no dependencies, both with tests) are meant to be copied:

- JavaScript: [`clients/osrs-icons.mjs`](clients/osrs-icons.mjs)
- Python: [`clients/osrs_icons.py`](clients/osrs_icons.py)

```js
import { iconsBase, itemIconUrl, skillIconUrl, slotIconUrl } from "./osrs-icons.mjs";
const base = iconsBase(config.iconsUrl); // "" disables icons → null
const stacks = await fetch(`${base}/data/stacks.json`).then((r) => r.json());
itemIconUrl(base, stacks, 995, 250); // → https://icons.scapekeeper.com/items/1002.webp
skillIconUrl(base, "Attack");        // → …/skills/attack.png
slotIconUrl(base, "AMULET");         // → …/slots/amulet.png
```

### Data collections

The collections index the icons: an id is only listed when `/items/{id}.webp` exists, and a link
(`noted`, `placeholder`, `bought`) is only present when its target has an icon too. All of it comes
from the game cache. Fields are only ever added.

**`items.json`** is keyed by item id. Noted and placeholder ids are not in it; look those up in
`noted.json` or `placeholders.json` first, then read the base item here.

```json
{
  "4151": {
    "name": "Abyssal whip",
    "examine": "A weapon from the Abyss.",
    "value": 120001,
    "highalch": 72000,
    "lowalch": 48000,
    "members": true,
    "tradeable": true,
    "ge": true,
    "weight": 0.453,
    "options": ["Wield", "Drop"],
    "noted": 4152,
    "placeholder": 14032
  }
}
```

- `name`, `value`, `highalch` and `lowalch` are always present. Every other field is left out when
  it is false, zero, empty or unknown.
- `value` is the store price. `highalch` and `lowalch` are 60% and 40% of it, rounded down. The cache
  doesn't say whether an item can actually be alched.
- `tradeable` is player-to-player; `ge` is the Grand Exchange.
- `weight` is in kg and can be negative.
- `options` are the inventory actions, in menu order.
- `bought` is the untradeable copy the Grand Exchange hands out (a bought bond). That copy is listed
  too, with `base` pointing back.
- Ids the cache leaves unnamed (stack variants such as `996`, interface-only models) have an icon
  but are not listed.

**`equipment.json`** has an entry for each item in `items.json` that is worn in one of the
`/slots/` slots.

```json
{
  "861": {
    "slot": "weapon",
    "twoHanded": true,
    "attack": { "stab": 0, "slash": 0, "crush": 0, "magic": 0, "ranged": 69 },
    "defence": { "stab": 0, "slash": 0, "crush": 0, "magic": 0, "ranged": 0 },
    "strength": 0,
    "rangedStrength": 0,
    "magicDamage": 0,
    "prayer": 0,
    "speed": 4,
    "range": 7
  }
}
```

- The bonus block is always complete. `magicDamage` is a percentage.
- Weapons add `speed` (ticks per attack) and `range` (tiles) when the cache has them, and
  `twoHanded` when true.
- There are no skill requirements: the cache's requirement fields sometimes hold the level to
  *make* the item instead.

### Displaying

- Show items at **36×32 CSS px**. The 2× source keeps them sharp on HiDPI screens.
- The skill and slot sprites are native size (about 25 px). If you scale them up, use
  `image-rendering: pixelated`.
- Placeholders render like the real item. The game shows them translucent, so add
  `opacity: 0.5` yourself.
- Quantities aren't drawn into the image. Overlay the stack count yourself (yellow < 100k,
  white < 10M, green ≥ 10M in game).

### Configuration in consumers

Every consumer has a **base URL setting** that defaults to `https://icons.scapekeeper.com`:

- an empty value turns icons off;
- any other URL points at a mirror.

This lets offline or privacy-minded self-hosters opt out or run their own copy.

## Self-hosting

Each publish also creates a [GitHub Release](../../releases) with `osrs-icons-rev{build}-{openrs2}.tar.gz`.
It has the same layout as the CDN. Extract it into any static web root, add a CORS header, and set
the consumers' base URL to that host.

## How it's built

```
OpenRS2 archive ──► fetch-cache.mjs ──► generator (Java, RuneLite cache lib) ──► build.mjs ──► verify.mjs ──► R2 + Release
 caches.json         newest COMPLETE       IconDump: every item, stack tables,     PNG → WebP     sanity gate
                     live cache            named sprites                          aliases
```

- **`scripts/fetch-cache.mjs`**
  - Picks the newest live oldschool cache from `archive.openrs2.org/caches.json` whose indexes and
    groups are all valid, and whose group count is within 2% of the recent maximum.
  - OpenRS2 lists a cache while it is still archiving it. Such an entry reports "100% valid" with a
    fraction of the groups. We saw 7,006 of about 117,000.
- **`generator/`** is a Gradle project on top of `net.runelite:cache` from repo.runelite.net.
  - `IconDump` renders every item definition with `IconItemSpriteFactory`, which is RuneLite's
    `ItemSpriteFactory` by way of group-ironmen.
  - Renders are 2× with a 1px outline and the in-game shadow `0x302020`. Models that overflow the frame
    are zoomed out until they fit.
  - `IconDump` also writes the stack tables, the named sprites listed in `scripts/aliases.mjs`, and
    the raw definition of every rendered id.
- **`scripts/collections.mjs`** shapes those definitions into the `/data/` collections.
- **`scripts/build.mjs`** does the whole pipeline and writes `dist/` in the published layout, including
  `manifest.json`.
- **`scripts/verify.mjs`** fails the run when any of these is true:
  - fewer than 28k item icons;
  - key ids are missing (coins stacks, whip, noted whip, bond);
  - any skill or slot alias is missing;
  - fewer than 300 stack tables;
  - a collection lists or links an id without an icon, or is much smaller than expected;
  - the bonuses of a few well-known items look wrong (the cache's params were renumbered);
  - an empty file;
  - the item count dropped more than 2% versus the live manifest.

### Publishing (`.github/workflows/publish.yml`)

- **Schedule:** Thursday and Monday 06:00 UTC, plus manual `workflow_dispatch`.
- **Skip check:** `scripts/check-live.mjs` compares the selected cache id and the generator hash
  (`scripts/generator-hash.mjs`, which covers only files that shape the output) with the live
  `manifest.json`. If both match, the run stops within
  seconds.
- **Upload:** `rclone copy --checksum` to R2, so only changed bytes are sent. `manifest.json` goes
  last. Nothing is ever deleted.
- **Release:** the tarball is attached to a GitHub Release tagged `rev{build}-{openrs2id}`.
- **Manual inputs:**
  - `force` rebuilds and re-uploads (still checksum-diffed).
  - `dry_run` builds, verifies and attaches `dist/` as a workflow artifact without publishing.

**Monitoring:** a failed scheduled run emails the repo owner, so "no email" means healthy. Two guards
make that true:

- **Keepalive:** every run calls `gh workflow enable`, because GitHub disables schedules after 60 days
  without commits.
- **Staleness:** if OpenRS2 has listed a newer game build for more than 3 days and it still isn't
  published, the run fails with an explanation. The usual causes are a cache that never completes, or
  a pipeline failure.

A failing run leaves the live icons untouched. The usual cause is a new cache format that
`net.runelite:cache` can't read yet. The dependency is `latest.release`, so the next run after
RuneLite ships a fix picks it up.

### Local development

Needs Node 22+ and JDK 21.

```bash
npm ci
npm test                  # resolver, cache-selection and collection tests (also: python -m unittest discover -s test)
npm run build             # downloads ~190 MB cache into .work/, renders ~34k icons into dist/ (~5 min)
npm run verify
node scripts/check-live.mjs https://icons.scapekeeper.com
```

`IconDump` takes `--ids 995,4151` to render just a few items while you experiment.

## Cloudflare setup (one-time)

1. **R2 → Create bucket** `osrs-icons`.
2. **Bucket → Settings → Custom Domains → Connect** `icons.scapekeeper.com`. Leave the `r2.dev`
   public URL **disabled**.
3. **R2 → Manage API tokens → Create**: Object Read & Write, limited to the `osrs-icons` bucket.
   Add these repo secrets: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
4. **scapekeeper.com → Rules → Transform Rules → Modify Response Header**:
   - when hostname equals `icons.scapekeeper.com`, set `Access-Control-Allow-Origin: *`;
   - R2's own CORS config only answers requests that carry an `Origin` header. A response cached
     without that header would then be served to browsers without CORS.
5. **scapekeeper.com → Caching → Cache Rules**:
   - when hostname equals `icons.scapekeeper.com`, mark it eligible for cache and use the origin's
     `Cache-Control`;
   - without this, JSON isn't edge-cached.
6. Optional repo variables: `ICONS_URL` and `R2_BUCKET`, if they differ from the defaults.
7. Run **Publish icons** with `dry_run`, inspect the artifact, then run it normally.

Check it's live:

```bash
curl -sI https://icons.scapekeeper.com/items/4151.webp
```

It should show `200`, `image/webp`, `cache-control`, `access-control-allow-origin: *` and, on the
second request, `cf-cache-status: HIT`.

## Gotchas

- **Changing `Cache-Control` later:** rclone skips files whose checksum is unchanged, so new
  headers won't reach existing objects. Run one upload with `--ignore-checksum`.
- **rclone reads every `RCLONE_*` environment variable as a flag:** `RCLONE_VERSION=v1.75.1` becomes
  `--version=v1.75.1` and aborts the upload. Workflow variables that aren't rclone settings must use
  another prefix; the pin is `PIN_RCLONE_VERSION`.
- **Rendering is single-threaded:** RuneLite's rasterizer keeps static state.
- **No `/sprites/{id}` path, on purpose:** add a semantic alias to `scripts/aliases.mjs` instead,
  and only ever add to it.

## Licensing

- **Code:** [BSD-2-Clause](LICENSE).
- **Images:** © Jagex Ltd, for non-commercial fan tools. See [NOTICE](NOTICE).
