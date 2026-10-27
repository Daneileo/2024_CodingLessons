import type { EcsWorld, InputState, System } from "../../core/interfaces";
import { PlayerController, Transform, Velocity } from "../components";

export class PlayerInputSystem implements System {
  readonly name = "player-input";

  constructor(private readonly input: InputState) {}

  update(_dt: number, world: EcsWorld): void {
    for (const entity of world.query([Transform, Velocity, PlayerController])) {
      const transform = world.get(entity, Transform);
      const velocity = world.get(entity, Velocity);
      const controller = world.get(entity, PlayerController);
      if (!transform || !velocity || !controller) continue;

      transform.yaw = this.input.yaw;
      transform.pitch = this.input.pitch;
      controller.flying = this.input.flying;

      const sin = Math.sin(transform.yaw);
      const cos = Math.cos(transform.yaw);
      let wishX = 0;
      let wishZ = 0;
      if (this.input.forward) {
        wishX += -sin;
        wishZ += -cos;
      }
      if (this.input.back) {
        wishX -= -sin;
        wishZ -= -cos;
      }
      if (this.input.left) {
        wishX += -cos;
        wishZ += sin;
      }
      if (this.input.right) {
        wishX -= -cos;
        wishZ -= sin;
      }
      const length = Math.hypot(wishX, wishZ);
      if (length > 0) {
        wishX /= length;
        wishZ /= length;
      }
      const speed = controller.flying ? controller.flySpeed : controller.walkSpeed;
      velocity.x = wishX * speed;
      velocity.z = wishZ * speed;
      if (controller.flying) {
        const vertical = (this.input.jump ? 1 : 0) - (this.input.sneak ? 1 : 0);
        velocity.y = vertical * speed;
      } else if (this.input.jump && controller.onGround) {
        velocity.y = controller.jumpSpeed;
      }
    }
  }
}
