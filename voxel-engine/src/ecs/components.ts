import type { ComponentType } from "../core/interfaces";

let nextComponentId = 1;

export function defineComponent<T>(name: string): ComponentType<T> {
  return { id: nextComponentId++, name };
}

export interface Transform {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface Velocity {
  x: number;
  y: number;
  z: number;
}

export interface Aabb {
  width: number;
  height: number;
  depth: number;
}

export interface PlayerController {
  walkSpeed: number;
  flySpeed: number;
  jumpSpeed: number;
  flying: boolean;
  onGround: boolean;
}

export interface Gravity {
  acceleration: number;
  terminal: number;
}

export const Transform = defineComponent<Transform>("transform");
export const Velocity = defineComponent<Velocity>("velocity");
export const Aabb = defineComponent<Aabb>("aabb");
export const PlayerController = defineComponent<PlayerController>("player");
export const Gravity = defineComponent<Gravity>("gravity");
