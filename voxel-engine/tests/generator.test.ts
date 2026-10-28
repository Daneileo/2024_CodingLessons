import { describe, expect, it } from "vitest";
import { WORLD_MAX_Y, WORLD_MIN_Y } from "../src/core/constants";
import { loadGameData } from "../src/registry/load-data";
import { Chunk } from "../src/world/chunk";
import { sampleClimate } from "../src/world/climate";
import { findLandSpawn, generateColumn, inspectColumn, NoiseTerrainGenerator } from "../src/world/generator";

function checksum(sections: Array<Uint16Array | null>): number {
  let hash = 2166136261;
  for (const section of sections) {
    if (!section) {
      hash ^= 0x11;
      hash = Math.imul(hash, 16777619);
      continue;
    }
    for (let i = 0; i < section.length; i += 17) {
      hash ^= section[i];
      hash = Math.imul(hash, 16777619);
    }
  }
  return hash >>> 0;
}

describe("terrain generator", () => {
  const data = loadGameData();

  it("is deterministic and keeps bedrock under air", () => {
    const first = generateColumn(0, 0, 1337, data.blocks, data.biomes);
    const second = generateColumn(0, 0, 1337, data.blocks, data.biomes);
    expect(checksum(first)).toBe(checksum(second));
    expect(checksum(generateColumn(1, 0, 1337, data.blocks, data.biomes))).not.toBe(checksum(first));

    const column = new Chunk(0, 0, first);
    expect(column.getBlock(0, WORLD_MIN_Y, 0)).toBe(data.blocks.resolve("strata:bedrock"));
    expect(column.getBlock(0, WORLD_MAX_Y, 0)).toBe(data.blocks.airStateId);

    const info = inspectColumn(8, 8, 1337, data.biomes);
    expect(info.surfaceY).toBeGreaterThan(WORLD_MIN_Y + 8);
    expect(info.surfaceY).toBeLessThan(WORLD_MAX_Y - 8);
    expect(column.getBlock(8, info.surfaceY, 8)).not.toBe(data.blocks.airStateId);
  });

  it("samples the same climate twice and finds a dry spawn", () => {
    const left = sampleClimate(12, -4, 1337);
    const right = sampleClimate(12, -4, 1337);
    expect(left.temperature).toBe(right.temperature);
    expect(left.continentalness).toBe(right.continentalness);
    const spawn = findLandSpawn(1337, data.biomes);
    const column = inspectColumn(Math.floor(spawn.x), Math.floor(spawn.z), 1337, data.biomes);
    expect(column.biomeId).not.toBe("strata:ocean");
    expect(column.surfaceY).toBeGreaterThanOrEqual(63);
  });

  it("generates a negative column through the generator object", () => {
    const generator = new NoiseTerrainGenerator(99, data.blocks, data.biomes);
    const sections = generator.generate(-3, 4);
    expect(sections).toHaveLength(24);
    expect(sections.some((section) => section !== null)).toBe(true);
  });
});
