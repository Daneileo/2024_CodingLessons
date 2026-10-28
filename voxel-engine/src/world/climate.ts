import { SEA_LEVEL, WORLD_MAX_Y, WORLD_MIN_Y } from "../core/constants";
import type { BiomeDefinition, ClimateSample } from "../core/interfaces";
import { LatticeNoise } from "./noise";

const TEMP_FREQUENCY = 0.0011;
const HUMID_FREQUENCY = 0.0011;
const CONTINENT_FREQUENCY = 0.00065;
const EROSION_FREQUENCY = 0.0016;
const WEIRD_FREQUENCY = 0.0024;
const DETAIL_FREQUENCY = 0.018;

/** One noise set per seed, reused across every column in a chunk. */
export class ClimateField {
  private readonly temperature: LatticeNoise;
  private readonly humidity: LatticeNoise;
  private readonly continentalness: LatticeNoise;
  private readonly erosion: LatticeNoise;
  private readonly weirdness: LatticeNoise;
  private readonly detail: LatticeNoise;

  constructor(seed: number) {
    this.temperature = new LatticeNoise(seed + 11);
    this.humidity = new LatticeNoise(seed + 29);
    this.continentalness = new LatticeNoise(seed + 47);
    this.erosion = new LatticeNoise(seed + 71);
    this.weirdness = new LatticeNoise(seed + 97);
    this.detail = new LatticeNoise(seed + 131);
  }

  sample(worldX: number, worldZ: number): ClimateSample {
    return {
      temperature: this.temperature.fbm2(worldX, worldZ, 4, TEMP_FREQUENCY) * 0.5 + 0.5,
      humidity: this.humidity.fbm2(worldX, worldZ, 4, HUMID_FREQUENCY) * 0.5 + 0.5,
      continentalness: this.continentalness.fbm2(worldX, worldZ, 5, CONTINENT_FREQUENCY),
      erosion: this.erosion.fbm2(worldX, worldZ, 3, EROSION_FREQUENCY) * 0.5 + 0.5,
      weirdness: this.weirdness.fbm2(worldX, worldZ, 4, WEIRD_FREQUENCY),
      detail: this.detail.fbm2(worldX, worldZ, 3, DETAIL_FREQUENCY),
    };
  }
}

export function sampleClimate(worldX: number, worldZ: number, seed: number): ClimateSample {
  return new ClimateField(seed).sample(worldX, worldZ);
}

/** Column height before caves. Shared by generation and the spawn search. */
export function terrainHeight(climate: ClimateSample): number {
  let height = SEA_LEVEL + climate.continentalness * 26;
  height += (1 - climate.erosion) * 6;
  const mountain = Math.max(0, climate.continentalness - 0.12) * Math.max(0, climate.weirdness);
  height += mountain * 52;
  height += climate.detail * 5;
  return Math.max(WORLD_MIN_Y + 8, Math.min(WORLD_MAX_Y - 8, Math.round(height)));
}

export function selectBiome(biomes: readonly BiomeDefinition[], climate: ClimateSample): BiomeDefinition {
  const byId = new Map(biomes.map((biome) => [biome.id, biome]));
  const pick = (id: string): BiomeDefinition => {
    const biome = byId.get(id);
    if (!biome) throw new Error(`missing biome ${id}`);
    return biome;
  };
  if (climate.continentalness < -0.22) return pick("strata:ocean");
  if (climate.continentalness > 0.5 && climate.temperature < 0.28) return pick("strata:snowy_peaks");
  if (climate.continentalness > 0.42) return pick("strata:mountains");

  let best = pick("strata:plains");
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const biome of biomes) {
    if (biome.selection !== "climate") continue;
    const distance = (biome.temperature - climate.temperature) ** 2 + (biome.humidity - climate.humidity) ** 2;
    if (distance < bestDistance) {
      best = biome;
      bestDistance = distance;
    }
  }
  return best;
}
