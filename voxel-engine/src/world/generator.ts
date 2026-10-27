import { SEA_LEVEL, WORLD_MIN_Y } from "../core/constants";
import type { BiomeDefinition, BlockRegistry, ClimateSample, TerrainGenerator } from "../core/interfaces";
import { ClimateField, selectBiome, terrainHeight } from "./climate";
import { Chunk } from "./chunk";
import { hashInt, LatticeNoise } from "./noise";

export interface ColumnInfo {
  readonly biomeId: string;
  readonly surfaceY: number;
  readonly climate: ClimateSample;
}

interface Palette {
  readonly air: number;
  readonly bedrock: number;
  readonly water: number;
  readonly stone: number;
  readonly coalOre: number;
  readonly ironOre: number;
  readonly oakLog: number;
  readonly oakLeaves: number;
}

function paletteFrom(registry: BlockRegistry): Palette {
  return {
    air: registry.resolve("strata:air"),
    bedrock: registry.resolve("strata:bedrock"),
    water: registry.resolve("strata:water"),
    stone: registry.resolve("strata:stone"),
    coalOre: registry.resolve("strata:coal_ore"),
    ironOre: registry.resolve("strata:iron_ore"),
    oakLog: registry.resolve("strata:oak_log", { axis: "y" }),
    oakLeaves: registry.resolve("strata:oak_leaves"),
  };
}

export function inspectColumn(
  worldX: number,
  worldZ: number,
  seed: number,
  biomes: readonly BiomeDefinition[],
): ColumnInfo {
  const climate = new ClimateField(seed).sample(worldX, worldZ);
  const biome = selectBiome(biomes, climate);
  return { biomeId: biome.id, surfaceY: terrainHeight(climate), climate };
}

/** Spiral outward until a dry column shows up, so the player does not spawn underwater. */
export function findLandSpawn(seed: number, biomes: readonly BiomeDefinition[]): { x: number; z: number } {
  const field = new ClimateField(seed);
  for (let radius = 0; radius < 48; radius++) {
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
        const x = dx * 8 + 8;
        const z = dz * 8 + 8;
        const climate = field.sample(x, z);
        const biome = selectBiome(biomes, climate);
        if (biome.id === "strata:ocean") continue;
        if (terrainHeight(climate) < SEA_LEVEL + 2) continue;
        return { x: x + 0.5, z: z + 0.5 };
      }
    }
  }
  return { x: 8.5, z: 8.5 };
}

function placeTree(chunk: Chunk, lx: number, lz: number, surface: number, palette: Palette, seed: number, wx: number, wz: number): void {
  const trunk = 4 + (hashInt(wx, 9, wz, seed) % 3);
  for (let i = 1; i <= trunk; i++) {
    if (chunk.getBlock(lx, surface + i, lz) === palette.air) {
      chunk.setBlock(lx, surface + i, lz, palette.oakLog);
    }
  }
  const top = surface + trunk;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx === 0 && dz === 0 && dy <= 0) continue;
        const reach = Math.abs(dx) + Math.abs(dz) + Math.abs(dy);
        if (reach > 4) continue;
        if (reach === 4 && (hashInt(wx + dx, dy + 3, wz + dz, seed) & 3) === 0) continue;
        const x = lx + dx;
        const z = lz + dz;
        if (x < 0 || x > 15 || z < 0 || z > 15) continue;
        const y = top + dy;
        if (chunk.getBlock(x, y, z) === palette.air) chunk.setBlock(x, y, z, palette.oakLeaves);
      }
    }
  }
}

export function generateColumn(
  cx: number,
  cz: number,
  seed: number,
  registry: BlockRegistry,
  biomes: readonly BiomeDefinition[],
): Array<Uint16Array | null> {
  const palette = paletteFrom(registry);
  const climateField = new ClimateField(seed);
  const caves = new LatticeNoise(seed + 900);
  const noodles = new LatticeNoise(seed + 1200);
  const ores = new LatticeNoise(seed + 50);
  const states = new Map<string, number>();
  const stateOf = (id: string): number => {
    const cached = states.get(id);
    if (cached !== undefined) return cached;
    const resolved = registry.resolve(id);
    states.set(id, resolved);
    return resolved;
  };

  const chunk = new Chunk(cx, cz);
  const heights = new Int16Array(256);
  const plantTree = new Uint8Array(256);

  for (let lz = 0; lz < 16; lz++) {
    for (let lx = 0; lx < 16; lx++) {
      const wx = cx * 16 + lx;
      const wz = cz * 16 + lz;
      const climate = climateField.sample(wx, wz);
      const biome = selectBiome(biomes, climate);
      const height = terrainHeight(climate);
      const index = lx + lz * 16;
      heights[index] = height;
      const surfaceId = height >= SEA_LEVEL ? biome.surface : biome.underwaterSurface;
      const surface = stateOf(surfaceId);
      const subsurface = stateOf(biome.subsurface);
      const filler = stateOf(biome.filler);
      const bedrockUntil = WORLD_MIN_Y + (hashInt(wx, 1, wz, seed) % 5);

      for (let y = WORLD_MIN_Y; y <= height; y++) {
        let state = filler;
        if (y <= bedrockUntil) state = palette.bedrock;
        else if (y === height) state = surface;
        else if (y > height - 4) state = subsurface;
        else if (state === palette.stone && y < 96) {
          const blob = ores.sample3(wx * 0.18, y * 0.18, wz * 0.18);
          if (y < 48 && blob > 0.62) state = palette.ironOre;
          else if (blob > 0.72) state = palette.coalOre;
        }
        chunk.setBlock(lx, y, lz, state);
      }

      if (height < SEA_LEVEL) {
        for (let y = height + 1; y <= SEA_LEVEL; y++) chunk.setBlock(lx, y, lz, palette.water);
      }

      if (biome.trees && height >= SEA_LEVEL + 1 && lx >= 2 && lx <= 13 && lz >= 2 && lz <= 13) {
        if (hashInt(wx, 2, wz, seed) % 180 === 0) plantTree[index] = 1;
      }
    }
  }

  for (let lz = 0; lz < 16; lz++) {
    for (let lx = 0; lx < 16; lx++) {
      const wx = cx * 16 + lx;
      const wz = cz * 16 + lz;
      const height = heights[lx + lz * 16];
      const floor = WORLD_MIN_Y + 6;
      const roof = height - 6;
      for (let y = floor; y <= roof; y++) {
        const cheese = caves.fbm3(wx, y, wz, 3, 0.05);
        const noodle = Math.abs(noodles.fbm3(wx, y * 1.35, wz, 2, 0.08));
        if (cheese > 0.4 || (noodle < 0.04 && cheese > 0.08)) {
          chunk.setBlock(lx, y, lz, palette.air);
        }
      }
      if (plantTree[lx + lz * 16]) placeTree(chunk, lx, lz, height, palette, seed, wx, wz);
    }
  }

  chunk.compact();
  return chunk.sections;
}

export class NoiseTerrainGenerator implements TerrainGenerator {
  constructor(
    readonly seed: number,
    private readonly blocks: BlockRegistry,
    private readonly biomes: readonly BiomeDefinition[],
  ) {}

  generate(cx: number, cz: number): Array<Uint16Array | null> {
    return generateColumn(cx, cz, this.seed, this.blocks, this.biomes);
  }
}
