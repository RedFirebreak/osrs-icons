"""Reference resolver for the icons.scapekeeper.com URL contract.

Copy it into a consumer; it has no dependencies. Mirrors clients/osrs-icons.mjs.
"""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence

DEFAULT_ICONS_URL = "https://icons.scapekeeper.com"

# /data/stacks.json: {"995": [[2, 996], [3, 997], ...]} sorted by breakpoint.
Stacks = Mapping[str, Sequence[Sequence[int]]]


def icons_base(configured: str | None = DEFAULT_ICONS_URL) -> str | None:
    """Normalise a configured base URL. None means icons are disabled (empty string)."""
    base = (DEFAULT_ICONS_URL if configured is None else configured).strip().rstrip("/")
    return base or None


def stacked_item_id(stacks: Stacks | None, item_id: int, quantity: int = 1) -> int:
    """The item id whose image shows `quantity` of `item_id`: coins 995 x 250 -> 1001."""
    result = item_id
    for breakpoint, variant in (stacks or {}).get(str(item_id), ()):
        if quantity >= breakpoint:
            result = variant
    return result


def item_icon_url(base: str | None, stacks: Stacks | None, item_id: int | None, quantity: int = 1) -> str | None:
    if not base or item_id is None or item_id < 0:
        return None
    return f"{base}/items/{stacked_item_id(stacks, item_id, quantity)}.webp"


def skill_icon_url(base: str | None, skill: str | None) -> str | None:
    """'Attack' / 'attack' -> /skills/attack.png. Overall has no icon."""
    if not base or not skill:
        return None
    slug = skill.lower()
    return None if slug == "overall" else f"{base}/skills/{slug}.png"


def slot_icon_url(base: str | None, slot: str | None) -> str | None:
    """RuneLite EquipmentInventorySlot name ('HEAD', 'AMULET', ...) -> empty-slot silhouette."""
    if not base or not slot:
        return None
    return f"{base}/slots/{slot.lower()}.png"


def prayer_icon_url(base: str | None, prayer: str | None) -> str | None:
    """RuneLite Prayer name ('PROTECT_FROM_MELEE', 'RP_TRINITAS', ...) -> its lit prayer-book icon."""
    if not base or not prayer:
        return None
    return f"{base}/prayers/{prayer.lower()}.png"


def hiscore_slug(activity: str | None) -> str:
    """Hiscores activity name ("Kree'Arra", "LMS - Rank") -> its slug ('kreearra', 'lms_rank')."""
    text = (activity or "").lower().replace("'", "").replace("\u2019", "")
    return re.sub(r"[^a-z0-9]+", "_", text).strip("_")


def hiscore_icon_url(base: str | None, activity: str | None) -> str | None:
    """A hiscores activity (a boss, 'Clue Scrolls (all)', ...) -> the sprite RuneLite's hiscore panel draws."""
    slug = hiscore_slug(activity)
    if not base or not slug:
        return None
    return f"{base}/hiscores/{slug}.png"
