import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "clients"))

from osrs_icons import icons_base, item_icon_url, skill_icon_url, slot_icon_url, stacked_item_id  # noqa: E402

STACKS = {"995": [[2, 996], [3, 997], [4, 998], [5, 999], [25, 1000], [100, 1001], [250, 1002], [1000, 1003], [10000, 1004]]}
BASE = "https://icons.example"


class ResolverTest(unittest.TestCase):
    def test_stacks(self):
        self.assertEqual(stacked_item_id(STACKS, 995, 1), 995)
        self.assertEqual(stacked_item_id(STACKS, 995, 2), 996)
        self.assertEqual(stacked_item_id(STACKS, 995, 9999), 1003)
        self.assertEqual(stacked_item_id(STACKS, 995, 10000), 1004)
        self.assertEqual(stacked_item_id(STACKS, 4151, 5), 4151)
        self.assertEqual(stacked_item_id(None, 995, 5), 995)

    def test_base(self):
        self.assertEqual(icons_base("https://icons.example/"), BASE)
        self.assertIsNone(icons_base(""))
        self.assertEqual(icons_base(None), "https://icons.scapekeeper.com")

    def test_urls(self):
        self.assertEqual(item_icon_url(BASE, STACKS, 995, 100), f"{BASE}/items/1001.webp")
        self.assertIsNone(item_icon_url(None, STACKS, 4151))
        self.assertIsNone(item_icon_url(BASE, STACKS, -1))
        self.assertEqual(skill_icon_url(BASE, "Attack"), f"{BASE}/skills/attack.png")
        self.assertIsNone(skill_icon_url(BASE, "Overall"))
        self.assertEqual(slot_icon_url(BASE, "AMULET"), f"{BASE}/slots/amulet.png")


if __name__ == "__main__":
    unittest.main()
