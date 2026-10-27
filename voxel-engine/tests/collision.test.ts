import { describe, expect, it } from "vitest";
import { aabbIntersects, bodyAabb } from "../src/core/math/aabb";
import { moveBody } from "../src/core/math/collision";

function floorIsSolid(x: number, y: number, z: number): boolean {
  void x;
  void z;
  return Math.floor(y) <= 0;
}

describe("aabb physics", () => {
  it("detects overlapping boxes", () => {
    const body = bodyAabb({ x: 0, y: 0, z: 0 }, { width: 1, height: 1, depth: 1 });
    expect(aabbIntersects(body, { minX: 0.4, minY: 0.4, minZ: 0.4, maxX: 2, maxY: 2, maxZ: 2 })).toBe(true);
    expect(aabbIntersects(body, { minX: 2, minY: 0, minZ: 0, maxX: 3, maxY: 1, maxZ: 1 })).toBe(false);
  });

  it("lands on the top face of a solid floor", () => {
    const pos = { x: 0.5, y: 4, z: 0.5 };
    const velocity = { x: 0, y: -30, z: 0 };
    const size = { width: 0.6, height: 1.8, depth: 0.6 };
    const hit = moveBody(pos, velocity, size, 0.5, floorIsSolid, false);
    expect(hit.onGround).toBe(true);
    expect(pos.y).toBeCloseTo(1, 4);
    expect(velocity.y).toBe(0);
  });

  it("stops against a wall", () => {
    const pos = { x: 1.2, y: 1, z: 0.5 };
    const velocity = { x: 8, y: 0, z: 0 };
    const size = { width: 0.6, height: 1.8, depth: 0.6 };
    moveBody(pos, velocity, size, 0.5, (x) => Math.floor(x) >= 2, true);
    expect(pos.x + size.width / 2).toBeCloseTo(2, 4);
    expect(velocity.x).toBe(0);
  });

  it("hits a ceiling", () => {
    const pos = { x: 0.5, y: 1, z: 0.5 };
    const velocity = { x: 0, y: 12, z: 0 };
    const size = { width: 0.6, height: 1.8, depth: 0.6 };
    moveBody(pos, velocity, size, 0.5, (_x, y) => Math.floor(y) === 4, false);
    expect(pos.y + size.height).toBeCloseTo(4, 4);
    expect(velocity.y).toBe(0);
  });

  it("steps up a one-block ledge", () => {
    const pos = { x: 0.5, y: 1, z: 0.5 };
    const velocity = { x: 4, y: 0, z: 0 };
    const size = { width: 0.6, height: 1.8, depth: 0.6 };
    const solid = (x: number, y: number): boolean => Math.floor(y) <= 0 || (Math.floor(y) === 1 && Math.floor(x) >= 1);
    moveBody(pos, velocity, size, 0.5, solid, true);
    expect(pos.y).toBeGreaterThan(1.5);
    expect(pos.x).toBeGreaterThan(1);
  });
});
