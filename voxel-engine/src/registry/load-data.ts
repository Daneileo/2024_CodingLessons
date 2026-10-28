import type { BiomeDefinition, BlockRegistry, ItemRegistry } from "../core/interfaces";
import { BlockRegistryImpl } from "./block-registry";
import { ItemRegistryImpl } from "./item-registry";
import { parseBiome, parseBlock, parseItem } from "./parse";

export interface GameData {
  readonly blocks: BlockRegistry;
  readonly items: ItemRegistry;
  readonly biomes: readonly BiomeDefinition[];
}

const REQUIRED_BIOMES = ["strata:plains", "strata:ocean", "strata:mountains", "strata:snowy_peaks", "strata:forest", "strata:desert"];

function unwrap(module: unknown): unknown {
  if (module && typeof module === "object" && "default" in module) {
    return (module as { default: unknown }).default;
  }
  return module;
}

function sortedEntries(modules: Record<string, unknown>): Array<[string, unknown]> {
  return Object.entries(modules)
    .map(([path, module]) => [path, unwrap(module)] as [string, unknown])
    .sort(([a], [b]) => a.localeCompare(b));
}

export function loadGameData(): GameData {
  const blockModules = import.meta.glob("../../data/blocks/*.json", { eager: true });
  const itemModules = import.meta.glob("../../data/items/*.json", { eager: true });
  const biomeModules = import.meta.glob("../../data/biomes/*.json", { eager: true });

  const blocks = new BlockRegistryImpl();
  const blockEntries = sortedEntries(blockModules);
  const air = blockEntries.find(([path]) => path.endsWith("/air.json"));
  if (!air) throw new Error("data/blocks/air.json is required");
  blocks.register(parseBlock(air[1]));
  for (const [path, json] of blockEntries) {
    if (path === air[0]) continue;
    blocks.register(parseBlock(json));
  }
  blocks.freeze();

  const items = new ItemRegistryImpl();
  for (const [, json] of sortedEntries(itemModules)) {
    const item = parseItem(json);
    if (item.places && !blocks.getDefinition(item.places)) {
      throw new Error(`${item.id} places unknown block ${item.places}`);
    }
    items.register(item);
  }

  const biomes = sortedEntries(biomeModules).map(([, json]) => parseBiome(json));
  const biomeIds = new Set(biomes.map((biome) => biome.id));
  for (const id of REQUIRED_BIOMES) {
    if (!biomeIds.has(id)) throw new Error(`missing required biome ${id}`);
  }
  for (const biome of biomes) {
    for (const blockId of [biome.surface, biome.subsurface, biome.filler, biome.underwaterSurface]) {
      if (!blocks.getDefinition(blockId)) {
        throw new Error(`${biome.id} references unknown block ${blockId}`);
      }
    }
  }

  return { blocks, items, biomes };
}
