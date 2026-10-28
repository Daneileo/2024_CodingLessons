import { describe, expect, it } from "vitest";
import type { VoxelWorldView } from "../src/core/interfaces";
import { Aabb, Gravity, PlayerController, Transform, Velocity } from "../src/ecs/components";
import { PhysicsSystem } from "../src/ecs/systems/physics";
import { EcsWorldImpl } from "../src/ecs/world";

describe("entity world", () => {
  it("queries only entities that have every requested component", () => {
    const world = new EcsWorldImpl();
    const player = world.createEntity();
    const decoration = world.createEntity();
    world.add(player, Transform, { x: 0, y: 3, z: 0, yaw: 0, pitch: 0 });
    world.add(player, Velocity, { x: 0, y: 0, z: 0 });
    world.add(decoration, Transform, { x: 4, y: 0, z: 0, yaw: 0, pitch: 0 });
    expect([...world.query([Transform, Velocity])]).toEqual([player]);
    world.destroyEntity(player);
    expect(world.alive(player)).toBe(false);
    expect([...world.query([Transform])]).toEqual([decoration]);
  });

  it("drops a body onto solid voxels", () => {
    const voxels: VoxelWorldView = {
      getBlock: () => 1,
      isSolidAt: (_x, y) => Math.floor(y) <= 0,
      isCollidableAt: (_x, y) => Math.floor(y) <= 0,
    };
    const world = new EcsWorldImpl();
    const body = world.createEntity();
    world.add(body, Transform, { x: 0, y: 6, z: 0, yaw: 0, pitch: 0 });
    world.add(body, Velocity, { x: 0, y: 0, z: 0 });
    world.add(body, Gravity, { acceleration: 28, terminal: -60 });
    world.add(body, PlayerController, {
      walkSpeed: 4,
      flySpeed: 10,
      jumpSpeed: 8,
      flying: false,
      onGround: false,
    });
    world.add(body, Aabb, { width: 0.6, height: 1.8, depth: 0.6 });
    const physics = new PhysicsSystem(voxels);
    world.addSystem(physics);
    for (let i = 0; i < 90; i++) world.tick(1 / 30);
    const transform = world.get(body, Transform);
    const controller = world.get(body, PlayerController);
    expect(transform?.y).toBeCloseTo(1, 2);
    expect(controller?.onGround).toBe(true);
  });
});
