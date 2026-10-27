import { describe, expect, it } from "vitest";
import { SECTION_COUNT_Y, WORLD_MIN_Y } from "../src/core/constants";
import { decodeSections, encodeSections } from "../src/world/codec";
import { Chunk } from "../src/world/chunk";
import { worldToChunk } from "../src/world/coords";

describe("columns", () => {
  it("maps negative world coordinates into the previous chunk", () => {
    expect(worldToChunk(0, 0)).toMatchObject({ cx: 0, cz: 0, lx: 0, lz: 0 });
    expect(worldToChunk(16, -1)).toMatchObject({ cx: 1, cz: -1, lx: 0, lz: 15 });
    expect(worldToChunk(-16.1, 15.9)).toMatchObject({ cx: -2, cz: 0, lx: 15, lz: 15 });
  });

  it("stores blocks sparsely and round-trips the codec", () => {
    const chunk = new Chunk(3, -2);
    expect(chunk.sections.every((section) => section === null)).toBe(true);
    chunk.setBlock(1, WORLD_MIN_Y + 20, 4, 7);
    expect(chunk.getBlock(1, WORLD_MIN_Y + 20, 4)).toBe(7);
    expect(chunk.getBlock(1, WORLD_MIN_Y + 21, 4)).toBe(0);
    const occupied = chunk.sections.filter((section) => section !== null).length;
    expect(occupied).toBe(1);
    expect(chunk.sections.length).toBe(SECTION_COUNT_Y);

    const decoded = new Chunk(3, -2, decodeSections(encodeSections(chunk.sections)));
    expect(decoded.getBlock(1, WORLD_MIN_Y + 20, 4)).toBe(7);
    expect(decoded.getBlock(2, WORLD_MIN_Y + 20, 4)).toBe(0);
  });
});
