import { describe, expect, it } from "vitest";
import { BlockRegistryImpl } from "../src/registry/block-registry";
import { loadGameData } from "../src/registry/load-data";
import { parseBlock } from "../src/registry/parse";

function solid(id: string, properties?: { name: string; values: string[] }[]) {
  return parseBlock({
    id,
    properties,
    default: properties ? { [properties[0].name]: properties[0].values[0] } : undefined,
    opacity: "solid",
    luminance: 0,
    hardness: 1,
    tool: { kind: "pickaxe", tier: 0 },
    collidable: true,
    solid: true,
    replaceable: false,
    tint: "#808080",
    textures: { all: "blocks/test" },
  });
}

describe("block registry", () => {
  it("loads air as state 0 and keeps property states distinct", () => {
    const data = loadGameData();
    expect(data.blocks.airStateId).toBe(0);
    expect(data.blocks.resolve("strata:air")).toBe(0);
    expect(data.blocks.isSolid(0)).toBe(false);
    expect(data.blocks.isCollidable(0)).toBe(false);
    const plain = data.blocks.resolve("strata:grass_block", { snowy: "false" });
    const snowy = data.blocks.resolve("strata:grass_block", { snowy: "true" });
    expect(plain).not.toBe(snowy);
    expect(data.blocks.getState(plain)?.values.snowy).toBe("false");
    expect(data.blocks.getDefinition("strata:glowstone")?.luminance).toBe(15);
    expect(data.blocks.getDefinition("strata:bedrock")?.hardness).toBe(-1);
    expect(data.items.get("strata:stick")?.places).toBeNull();
    expect(data.items.get("strata:stone")?.places).toBe("strata:stone");
    expect(data.biomes.length).toBeGreaterThanOrEqual(6);
  });

  it("packs hundreds of block ids into unique states", () => {
    const registry = new BlockRegistryImpl();
    registry.register(
      parseBlock({
        id: "strata:air",
        opacity: "invisible",
        luminance: 0,
        hardness: 0,
        tool: { kind: "none", tier: 0 },
        collidable: false,
        solid: false,
        replaceable: true,
        tint: "#000000",
        textures: { all: "blocks/air" },
      }),
    );
    for (let i = 0; i < 300; i++) {
      const properties = i % 5 === 0 ? [{ name: "lit", values: ["false", "true"] }] : undefined;
      registry.register(solid(`strata:block_${i}`, properties));
    }
    registry.freeze();
    expect(registry.stateCount).toBeGreaterThan(300);
    expect(registry.resolve("strata:block_0", { lit: "true" })).not.toBe(registry.resolve("strata:block_0", { lit: "false" }));
    expect(registry.resolve("strata:block_299")).toBeGreaterThan(0);
    expect(() => registry.register(solid("strata:late"))).toThrow(/frozen/);
  });
});
