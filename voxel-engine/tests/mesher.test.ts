import { describe, expect, it } from "vitest";
import { BlockRegistryImpl } from "../src/registry/block-registry";
import { parseBlock } from "../src/registry/parse";
import { meshSection } from "../src/world/mesher";

function registry() {
  const blocks = new BlockRegistryImpl();
  blocks.register(
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
  blocks.register(
    parseBlock({
      id: "strata:stone",
      opacity: "solid",
      luminance: 0,
      hardness: 1.5,
      tool: { kind: "pickaxe", tier: 0 },
      collidable: true,
      solid: true,
      replaceable: false,
      tint: "#7d7d7d",
      textures: { all: "blocks/stone" },
    }),
  );
  blocks.register(
    parseBlock({
      id: "strata:water",
      opacity: "translucent",
      luminance: 0,
      hardness: 100,
      tool: { kind: "none", tier: 0 },
      collidable: false,
      solid: false,
      replaceable: true,
      tint: "#3a6ea5",
      textures: { all: "blocks/water" },
    }),
  );
  blocks.freeze();
  return blocks;
}

describe("mesher", () => {
  const blocks = registry();
  const stone = blocks.resolve("strata:stone");
  const water = blocks.resolve("strata:water");

  it("emits six faces for an isolated block and only the shell of a solid cube", () => {
    const isolated = meshSection(0, 0, 0, (x, y, z) => (x === 0 && y === 0 && z === 0 ? stone : 0), blocks);
    expect(isolated.opaque?.indices.length).toBe(36);
    expect(isolated.translucent).toBeNull();

    const cube = meshSection(
      0,
      0,
      0,
      (x, y, z) => (x >= 0 && x <= 2 && y >= 0 && y <= 2 && z >= 0 && z <= 2 ? stone : 0),
      blocks,
    );
    expect(cube.opaque?.indices.length).toBe(54 * 6);
  });

  it("hides the shared face between two stacked blocks", () => {
    const stacked = meshSection(
      0,
      0,
      0,
      (x, y, z) => (x === 1 && z === 1 && (y === 0 || y === 1) ? stone : 0),
      blocks,
    );
    expect(stacked.opaque?.indices.length).toBe(10 * 6);
  });

  it("puts water in the translucent bucket and keeps the stone face against it", () => {
    const mixed = meshSection(
      0,
      0,
      0,
      (x, y, z) => {
        if (x === 0 && y === 0 && z === 0) return stone;
        if (x === 1 && y === 0 && z === 0) return water;
        return 0;
      },
      blocks,
    );
    expect(mixed.opaque).not.toBeNull();
    expect(mixed.translucent).not.toBeNull();
    expect(mixed.opaque && mixed.opaque.indices.length).toBe(36);
    expect(mixed.translucent && mixed.translucent.indices.length).toBe(5 * 6);
  });
});
