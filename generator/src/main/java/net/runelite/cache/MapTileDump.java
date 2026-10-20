package net.runelite.cache;

import com.google.gson.Gson;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import javax.imageio.ImageIO;
import net.runelite.cache.definitions.AreaDefinition;
import net.runelite.cache.definitions.ObjectDefinition;
import net.runelite.cache.definitions.SpriteDefinition;
import net.runelite.cache.fs.Store;
import net.runelite.cache.region.Location;
import net.runelite.cache.region.Region;
import net.runelite.cache.region.RegionLoader;
import net.runelite.cache.util.XteaKeyManager;

/**
 * Draws the world map from an OSRS disk cache with RuneLite's own MapImageDumper, without the icons
 * and the place names: the map draws those itself, from the positions written here.
 *
 * <pre>
 * MapTileDump --cache &lt;dir&gt; --out &lt;dir&gt; [--xteas &lt;keys.json&gt;]
 *   out/img-{plane}.png        the whole floor, 4 px a game tile, north up
 *   out/bounds.json            {"regionX": 15, "regionY": 19}: the map square at the images' south-west corner
 *   out/icons/{sprite}.png     every map icon (a mine, a bank, ...) that a location on the map shows
 *   out/icons/map-icons.json   {"sprite": [x, y, plane, x, y, plane, ...]}: where each is, in game coordinates
 * </pre>
 *
 * The icon positions follow group-ironmen's cache scripts (christoabrown/group-ironmen, BSD-2-Clause).
 */
public class MapTileDump
{
	public static void main(String[] args) throws IOException
	{
		String cacheDir = null;
		String outDir = null;
		String xteas = null;
		for (int i = 0; i < args.length; i++)
		{
			switch (args[i])
			{
				case "--cache":
					cacheDir = args[++i];
					break;
				case "--out":
					outDir = args[++i];
					break;
				case "--xteas":
					xteas = args[++i];
					break;
				default:
					throw new IllegalArgumentException("Unknown argument: " + args[i]);
			}
		}
		if (cacheDir == null || outDir == null)
		{
			throw new IllegalArgumentException("Usage: MapTileDump --cache <dir> --out <dir> [--xteas <keys.json>]");
		}

		XteaKeyManager keys = new XteaKeyManager();
		if (xteas != null)
		{
			try (FileInputStream in = new FileInputStream(xteas))
			{
				keys.loadKeys(in);
			}
		}

		File out = new File(outDir);
		new File(out, "icons").mkdirs();

		try (Store store = new Store(new File(cacheDir)))
		{
			store.load();

			RegionLoader regions = new RegionLoader(store, keys);
			regions.loadRegions();
			regions.calculateBounds();
			System.out.println("map: " + regions.getRegions().size() + " map squares");

			writeJson(new File(out, "bounds.json"), Map.of(
				"regionX", regions.getLowestX().getRegionX(),
				"regionY", regions.getLowestY().getRegionY()));

			dumpIcons(store, regions, new File(out, "icons"));

			MapImageDumper dumper = new MapImageDumper(store, regions)
				.setRenderIcons(false)
				.setRenderLabels(false);
			dumper.load();
			for (int plane = 0; plane < Region.Z; plane++)
			{
				BufferedImage image = dumper.drawMap(plane);
				ImageIO.write(image, "png", new File(out, "img-" + plane + ".png"));
				System.out.println("map: floor " + plane + " drawn, " + image.getWidth() + "x" + image.getHeight());
			}
		}
	}

	/** Every location whose object has a map icon: its sprite, and where it is. */
	private static void dumpIcons(Store store, RegionLoader regions, File outDir) throws IOException
	{
		ObjectManager objects = new ObjectManager(store);
		objects.load();
		AreaManager areas = new AreaManager(store);
		areas.load();
		SpriteManager sprites = new SpriteManager(store);
		sprites.load();

		Map<Integer, List<Integer>> icons = new TreeMap<>();
		for (Region region : regions.getRegions())
		{
			for (Location location : region.getLocations())
			{
				ObjectDefinition object = objects.getObject(location.getId());
				if (object == null || object.getMapAreaId() == -1)
				{
					continue;
				}
				AreaDefinition area = areas.getArea(object.getMapAreaId());
				if (area == null || area.spriteId == -1)
				{
					continue;
				}
				List<Integer> at = icons.computeIfAbsent(area.spriteId, k -> new ArrayList<>());
				at.add(location.getPosition().getX());
				at.add(location.getPosition().getY());
				at.add(location.getPosition().getZ());
			}
		}

		for (int spriteId : icons.keySet())
		{
			SpriteDefinition sprite = sprites.findSprite(spriteId, 0);
			BufferedImage image = new BufferedImage(sprite.getWidth(), sprite.getHeight(), BufferedImage.TYPE_INT_ARGB);
			int[] pixels = sprite.getPixels();
			for (int y = 0; y < sprite.getHeight(); y++)
			{
				for (int x = 0; x < sprite.getWidth(); x++)
				{
					int rgb = pixels[x + y * sprite.getWidth()];
					if (rgb != 0)
					{
						image.setRGB(x, y, rgb | 0xFF000000);
					}
				}
			}
			ImageIO.write(image, "png", new File(outDir, spriteId + ".png"));
		}
		writeJson(new File(outDir, "map-icons.json"), icons);
		System.out.println("map: " + icons.size() + " kinds of map icon");
	}

	private static void writeJson(File file, Object value) throws IOException
	{
		try (Writer writer = Files.newBufferedWriter(file.toPath(), StandardCharsets.UTF_8))
		{
			new Gson().toJson(value, writer);
		}
	}
}
