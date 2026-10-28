import type { EcsWorld, System, VoxelWorldView } from "../../core/interfaces";
import { moveBody } from "../../core/math/collision";
import { Aabb, Gravity, PlayerController, Transform, Velocity } from "../components";

export class PhysicsSystem implements System {
  readonly name = "physics";

  constructor(private readonly voxels: VoxelWorldView) {}

  update(dt: number, world: EcsWorld): void {
    for (const entity of world.query([Transform, Velocity])) {
      const transform = world.get(entity, Transform);
      const velocity = world.get(entity, Velocity);
      if (!transform || !velocity) continue;
      const controller = world.get(entity, PlayerController);
      const gravity = world.get(entity, Gravity);
      const box = world.get(entity, Aabb);
      if (gravity && !controller?.flying) {
        velocity.y -= gravity.acceleration * dt;
        if (velocity.y < gravity.terminal) velocity.y = gravity.terminal;
      }
      if (!box) {
        transform.x += velocity.x * dt;
        transform.y += velocity.y * dt;
        transform.z += velocity.z * dt;
        continue;
      }
      const hit = moveBody(
        transform,
        velocity,
        box,
        dt,
        (x, y, z) => this.voxels.isCollidableAt(x, y, z),
        controller?.onGround ?? false,
      );
      if (controller) controller.onGround = hit.onGround;
    }
  }
}
