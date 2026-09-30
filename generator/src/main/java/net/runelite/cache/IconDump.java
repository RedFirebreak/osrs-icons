package net.runelite.cache;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import javax.imageio.ImageIO;
import net.runelite.cache.definitions.ItemDefinition;
import net.runelite.cache.definitions.SpriteDefinition;
import net.runelite.cache.definitions.loaders.ModelLoader;
import net.runelite.cache.definitions.providers.ModelProvider;
import net.runelite.cache.fs.Archive;
import net.runelite.cache.fs.Index;
import net.runelite.cache.fs.Store;
import net.runelite.cache.item.IconItemSpriteFactory;

/**
 * Renders every item icon, the stack tables, and a chosen set of sprites from an OSRS disk cache.
 *
 * <pre>
 * IconDump --cache &lt;dir&gt; --out &lt;dir&gt; [--sprites 156,157,...] [--ids 995,4151,...]
 *   out/items/{id}.png     every item id that renders (base, noted, placeholder, bought, stack variants)
 *   out/sprites/{id}.png   frame 0 of each requested sprite id
 *   out/stacks.json        {"995": [[2, 996], ...]}  quantity breakpoint → variant item id
 *   out/stats.json         {"items": n, "noted": n, "placeholders": n, "failed": n, "empty": n, "sprites": n}
 * </pre>
 *
 * Rendering is single-threaded on purpose: the rasterizer keeps static state.
 */
public class IconDump
{
	// 1px black outline + the in-game drop shadow colour (RuneLite's SpritePixels.DEFAULT_SHADOW_COLOR).
	private static final int BORDER = 1;
	private static final int SHADOW_COLOR = 0x302020;

	public static void main(String[] args) throws IOException
	{
		String cacheDir = null;
		String outDir = null;
		List<Integer> spriteIds = new ArrayList<>();
		java.util.Set<Integer> onlyIds = null;
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
				case "--ids":
					onlyIds = new java.util.HashSet<>();
					for (String s : args[++i].split(","))
					{
						onlyIds.add(Integer.parseInt(s.trim()));
					}
					break;
				case "--sprites":
					for (String s : args[++i].split(","))
					{
						if (!s.isBlank())
						{
							spriteIds.add(Integer.parseInt(s.trim()));
						}
					}
					break;
				default:
					throw new IllegalArgumentException("Unknown argument: " + args[i]);
			}
		}
		if (cacheDir == null || outDir == null)
		{
			System.err.println("Usage: IconDump --cache <dir> --out <dir> [--sprites id,id,...]");
			System.exit(2);
		}

		File out = new File(outDir);
		File itemsOut = new File(out, "items");
		File spritesOut = new File(out, "sprites");
		itemsOut.mkdirs();
		spritesOut.mkdirs();

		try (Store store = new Store(new File(cacheDir)))
		{
			store.load();

			ItemManager items = new ItemManager(store);
			items.load();
			// Copies model/zoom from the note, placeholder and bought templates onto the linked ids.
			items.link();

			SpriteManager sprites = new SpriteManager(store);
			sprites.load();

			TextureManager textures = new TextureManager(store);
			textures.load();

			ModelProvider models = modelId ->
			{
				Index index = store.getIndex(IndexType.MODELS);
				Archive archive = index.getArchive(modelId);
				if (archive == null)
				{
					return null;
				}
				byte[] data = archive.decompress(store.getStorage().loadArchive(archive));
				return new ModelLoader().load(modelId, data);
			};

			int rendered = 0;
			int failed = 0;
			int empty = 0;
			int noted = 0;
			int placeholders = 0;
			Map<Integer, List<int[]>> stacks = new TreeMap<>();

			for (ItemDefinition def : items.getItems())
			{
				int id = def.getId();
				if (onlyIds != null && !onlyIds.contains(id))
				{
					continue;
				}

				List<int[]> table = stackTable(def);
				if (!table.isEmpty())
				{
					stacks.put(id, table);
				}

				BufferedImage image;
				try
				{
					image = IconItemSpriteFactory.createSprite(items, models, sprites, textures,
						id, 1, BORDER, SHADOW_COLOR, false);
				}
				catch (Exception | StackOverflowError ex)
				{
					failed++;
					System.err.println("item " + id + ": " + ex);
					continue;
				}
				if (image == null || isFullyTransparent(image))
				{
					empty++;
					continue;
				}
				ImageIO.write(image, "PNG", new File(itemsOut, id + ".png"));
				rendered++;
				if (def.notedTemplate != -1)
				{
					noted++;
				}
				else if (def.placeholderTemplateId != -1)
				{
					placeholders++;
				}
			}

			int spriteCount = 0;
			for (int spriteId : spriteIds)
			{
				SpriteDefinition def = sprites.findSprite(spriteId, 0);
				if (def == null)
				{
					System.err.println("sprite " + spriteId + ": not found");
					continue;
				}
				ImageIO.write(sprites.getSpriteImage(def), "PNG", new File(spritesOut, spriteId + ".png"));
				spriteCount++;
			}

			Gson gson = new GsonBuilder().create();
			writeJson(gson, new File(out, "stacks.json"), stacks);
			writeJson(gson, new File(out, "stats.json"), Map.of(
				"items", rendered, "noted", noted, "placeholders", placeholders,
				"failed", failed, "empty", empty, "sprites", spriteCount));

			System.out.printf("items rendered=%d (noted=%d placeholders=%d) failed=%d empty=%d, stacks=%d, sprites=%d%n",
				rendered, noted, placeholders, failed, empty, stacks.size(), spriteCount);
		}
	}

	/** Breakpoints the client uses to swap to a bigger-pile model, e.g. coins 995 → 996..1004. */
	private static List<int[]> stackTable(ItemDefinition def)
	{
		List<int[]> table = new ArrayList<>();
		if (def.countCo == null || def.countObj == null)
		{
			return table;
		}
		int n = Math.min(def.countCo.length, def.countObj.length);
		for (int i = 0; i < n; i++)
		{
			if (def.countCo[i] > 0 && def.countObj[i] > 0)
			{
				table.add(new int[]{def.countCo[i], def.countObj[i]});
			}
		}
		table.sort((a, b) -> Integer.compare(a[0], b[0]));
		return table;
	}

	private static boolean isFullyTransparent(BufferedImage image)
	{
		for (int y = 0; y < image.getHeight(); y++)
		{
			for (int x = 0; x < image.getWidth(); x++)
			{
				if ((image.getRGB(x, y) >>> 24) != 0)
				{
					return false;
				}
			}
		}
		return true;
	}

	private static void writeJson(Gson gson, File file, Object value) throws IOException
	{
		try (Writer w = Files.newBufferedWriter(file.toPath(), StandardCharsets.UTF_8))
		{
			gson.toJson(value, w);
		}
	}
}
