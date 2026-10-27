import type { InputState } from "../core/interfaces";

const LOOK_SPEED = 0.0022;
const PITCH_LIMIT = Math.PI / 2 - 0.01;

export function createInput(yaw = 0.7, pitch = -0.35): InputState {
  return {
    forward: false,
    back: false,
    left: false,
    right: false,
    jump: false,
    sneak: false,
    flying: false,
    yaw,
    pitch,
  };
}

export function bindInput(canvas: HTMLCanvasElement, pause: HTMLElement, crosshair: HTMLElement, input: InputState): void {
  const held = new Set<string>();
  const sync = (): void => {
    input.forward = held.has("KeyW") || held.has("ArrowUp");
    input.back = held.has("KeyS") || held.has("ArrowDown");
    input.left = held.has("KeyA") || held.has("ArrowLeft");
    input.right = held.has("KeyD") || held.has("ArrowRight");
    input.jump = held.has("Space");
    input.sneak = held.has("ShiftLeft") || held.has("ShiftRight");
  };

  window.addEventListener("keydown", (event) => {
    if (event.code === "KeyF" && !event.repeat) input.flying = !input.flying;
    held.add(event.code);
    sync();
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener("keyup", (event) => {
    held.delete(event.code);
    sync();
  });
  window.addEventListener("blur", () => {
    held.clear();
    sync();
  });

  canvas.addEventListener("click", () => {
    void canvas.requestPointerLock();
  });
  document.addEventListener("pointerlockchange", () => {
    const locked = document.pointerLockElement === canvas;
    pause.hidden = locked;
    crosshair.hidden = !locked;
  });
  document.addEventListener("mousemove", (event) => {
    if (document.pointerLockElement !== canvas) return;
    input.yaw -= event.movementX * LOOK_SPEED;
    input.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, input.pitch - event.movementY * LOOK_SPEED));
  });
}
