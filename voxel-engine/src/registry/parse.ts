import type {
  BiomeDefinition,
  BlockDefinition,
  BlockProperty,
  BlockTextures,
  ItemDefinition,
  Opacity,
  ToolKind,
  ToolRequirement,
} from "../core/interfaces";

const ID_PATTERN = /^[a-z0-9_]+:[a-z0-9_]+$/;
const OPACITIES = new Set<Opacity>(["solid", "cutout", "translucent", "invisible"]);
const TOOLS = new Set<ToolKind>(["none", "pickaxe", "shovel", "axe", "hoe"]);
const TEXTURE_KEYS = ["all", "top", "bottom", "side", "north", "south", "east", "west"] as const;

export interface BlockJson {
  id: string;
  properties?: { name: string; values: string[] }[];
  default?: Record<string, string>;
  opacity: Opacity;
  luminance: number;
  hardness: number;
  tool: { kind: ToolKind; tier: number };
  collidable: boolean;
  solid: boolean;
  replaceable: boolean;
  tint: string;
  textures: BlockTextures;
  drops?: string | null;
}

export interface ItemJson {
  id: string;
  maxStack: number;
  places?: string | null;
  tint: string;
}

export interface BiomeJson {
  id: string;
  surface: string;
  subsurface: string;
  filler: string;
  underwaterSurface: string;
  temperature: number;
  humidity: number;
  trees?: boolean;
  selection: "climate" | "special";
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${key} must be a string`);
  }
  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string, label: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") throw new Error(`${label}.${key} must be a boolean`);
  return value;
}

function requireNumber(record: Record<string, unknown>, key: string, label: string): number {
  const value = record[key];
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${label}.${key} must be a number`);
  }
  return value;
}

export function assertId(id: string, label: string): void {
  if (!ID_PATTERN.test(id)) {
    throw new Error(`${label} id "${id}" must look like "namespace:name"`);
  }
}

function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

export function parseTint(hex: string, label: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) throw new Error(`${label} tint "${hex}" must be #rrggbb`);
  const packed = Number.parseInt(match[1], 16);
  return [
    srgbToLinear(((packed >> 16) & 255) / 255),
    srgbToLinear(((packed >> 8) & 255) / 255),
    srgbToLinear((packed & 255) / 255),
  ];
}

function parseProperties(value: unknown, label: string): BlockProperty[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${label}.properties must be an array`);
  const seen = new Set<string>();
  return value.map((entry, index) => {
    const record = assertRecord(entry, `${label}.properties[${index}]`);
    const name = requireString(record, "name", `${label}.properties[${index}]`);
    if (seen.has(name)) throw new Error(`${label} repeats property ${name}`);
    seen.add(name);
    if (!Array.isArray(record.values) || record.values.length === 0) {
      throw new Error(`${label}.${name} needs at least one value`);
    }
    const values = record.values.map((item) => {
      if (typeof item !== "string" || item.length === 0) {
        throw new Error(`${label}.${name} values must be strings`);
      }
      return item;
    });
    if (new Set(values).size !== values.length) {
      throw new Error(`${label}.${name} has duplicate values`);
    }
    return { name, values };
  });
}

function parseTextures(value: unknown, label: string): BlockTextures {
  const record = assertRecord(value, `${label}.textures`);
  const textures: Record<string, string> = {};
  for (const key of TEXTURE_KEYS) {
    if (record[key] === undefined) continue;
    textures[key] = requireString(record, key, `${label}.textures`);
  }
  if (Object.keys(textures).length === 0) {
    throw new Error(`${label}.textures needs at least one face`);
  }
  return textures;
}

function parseTool(value: unknown, label: string): ToolRequirement {
  const record = assertRecord(value, `${label}.tool`);
  const kind = requireString(record, "kind", `${label}.tool`);
  if (!TOOLS.has(kind as ToolKind)) throw new Error(`${label}.tool.kind is invalid`);
  const tier = requireNumber(record, "tier", `${label}.tool`);
  if (tier < 0 || !Number.isInteger(tier)) throw new Error(`${label}.tool.tier must be a whole number`);
  return { kind: kind as ToolKind, tier };
}

export function parseBlock(json: unknown): BlockDefinition {
  const record = assertRecord(json, "block");
  const id = requireString(record, "id", "block");
  assertId(id, "block");
  const properties = parseProperties(record.properties, id);
  const defaults: Record<string, string> = {};
  if (record.default !== undefined) {
    const raw = assertRecord(record.default, `${id}.default`);
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value !== "string") throw new Error(`${id}.default.${key} must be a string`);
      defaults[key] = value;
    }
  }
  for (const property of properties) {
    const chosen = defaults[property.name];
    if (chosen === undefined) throw new Error(`${id} is missing a default for ${property.name}`);
    if (!property.values.includes(chosen)) {
      throw new Error(`${id} default ${property.name}=${chosen} is not an allowed value`);
    }
  }
  for (const key of Object.keys(defaults)) {
    if (!properties.some((property) => property.name === key)) {
      throw new Error(`${id} default names unknown property ${key}`);
    }
  }
  const opacity = requireString(record, "opacity", id);
  if (!OPACITIES.has(opacity as Opacity)) throw new Error(`${id} opacity is invalid`);
  const luminance = requireNumber(record, "luminance", id);
  if (luminance < 0 || luminance > 15) throw new Error(`${id} luminance must be 0..15`);
  const hardness = requireNumber(record, "hardness", id);
  const drops = record.drops === undefined || record.drops === null ? null : requireString(record, "drops", id);
  if (drops) assertId(drops, `${id} drops`);
  return {
    id,
    properties,
    defaultState: defaults,
    opacity: opacity as Opacity,
    luminance,
    hardness,
    tool: parseTool(record.tool, id),
    collidable: requireBoolean(record, "collidable", id),
    solid: requireBoolean(record, "solid", id),
    replaceable: requireBoolean(record, "replaceable", id),
    tint: parseTint(requireString(record, "tint", id), id),
    textures: parseTextures(record.textures, id),
    drops,
  };
}

export function parseItem(json: unknown): ItemDefinition {
  const record = assertRecord(json, "item");
  const id = requireString(record, "id", "item");
  assertId(id, "item");
  const maxStack = requireNumber(record, "maxStack", id);
  if (!Number.isInteger(maxStack) || maxStack < 1 || maxStack > 64) {
    throw new Error(`${id} maxStack must be an integer from 1 to 64`);
  }
  const places = record.places === undefined || record.places === null ? null : requireString(record, "places", id);
  if (places) assertId(places, `${id} places`);
  return {
    id,
    maxStack,
    places,
    tint: parseTint(requireString(record, "tint", id), id),
  };
}

export function parseBiome(json: unknown): BiomeDefinition {
  const record = assertRecord(json, "biome");
  const id = requireString(record, "id", "biome");
  assertId(id, "biome");
  const selection = requireString(record, "selection", id);
  if (selection !== "climate" && selection !== "special") {
    throw new Error(`${id} selection must be "climate" or "special"`);
  }
  const temperature = requireNumber(record, "temperature", id);
  const humidity = requireNumber(record, "humidity", id);
  if (temperature < 0 || temperature > 1 || humidity < 0 || humidity > 1) {
    throw new Error(`${id} temperature and humidity must be 0..1`);
  }
  for (const key of ["surface", "subsurface", "filler", "underwaterSurface"] as const) {
    assertId(requireString(record, key, id), `${id}.${key}`);
  }
  return {
    id,
    surface: requireString(record, "surface", id),
    subsurface: requireString(record, "subsurface", id),
    filler: requireString(record, "filler", id),
    underwaterSurface: requireString(record, "underwaterSurface", id),
    temperature,
    humidity,
    trees: record.trees === undefined ? false : requireBoolean(record, "trees", id),
    selection,
  };
}
