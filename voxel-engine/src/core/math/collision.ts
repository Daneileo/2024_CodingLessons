import { bodyAabb, type BodySize, type Vec3 } from "./aabb";

export type Axis = "x" | "y" | "z";

const EPS = 1e-4;
const MAX_SUBSTEP = 0.45;
const STEP_HEIGHT = 1.01;

type SolidQuery = (x: number, y: number, z: number) => boolean;

function axisIndex(axis: Axis): 0 | 1 | 2 {
  if (axis === "x") return 0;
  if (axis === "y") return 1;
  return 2;
}

/**
 * Clip a single-axis move so the body stops flush against the first solid block.
 * Other axes stay put, which is the usual voxel-body resolution order.
 */
export function clipDelta(pos: Vec3, size: BodySize, axis: Axis, delta: number, isSolid: SolidQuery): number {
  if (delta === 0) return 0;
  const box = bodyAabb(pos, size);
  const min = [box.minX, box.minY, box.minZ];
  const max = [box.maxX, box.maxY, box.maxZ];
  const a = axisIndex(axis);
  const u = ((a + 1) % 3) as 0 | 1 | 2;
  const v = ((a + 2) % 3) as 0 | 1 | 2;

  const u0 = Math.floor(min[u] + EPS);
  const u1 = Math.floor(max[u] - EPS);
  const v0 = Math.floor(min[v] + EPS);
  const v1 = Math.floor(max[v] - EPS);
  const sweepMin = Math.min(min[a], min[a] + delta);
  const sweepMax = Math.max(max[a], max[a] + delta);
  const a0 = Math.floor(sweepMin + EPS);
  const a1 = Math.floor(sweepMax - EPS);

  let clipped = delta;
  const coord = [0, 0, 0];
  for (let ia = a0; ia <= a1; ia++) {
    for (let iu = u0; iu <= u1; iu++) {
      for (let iv = v0; iv <= v1; iv++) {
        coord[a] = ia;
        coord[u] = iu;
        coord[v] = iv;
        if (!isSolid(coord[0], coord[1], coord[2])) continue;
        if (delta > 0) {
          const gap = ia - max[a];
          if (gap >= -EPS && gap < clipped) clipped = gap > 0 ? gap : 0;
        } else {
          const gap = ia + 1 - min[a];
          if (gap <= EPS && gap > clipped) clipped = gap < 0 ? gap : 0;
        }
      }
    }
  }
  return clipped;
}

function blocked(delta: number, clipped: number): boolean {
  return Math.abs(clipped - delta) > 1e-6;
}

function moveHorizontal(
  pos: Vec3,
  velocity: Vec3,
  size: BodySize,
  axis: "x" | "z",
  delta: number,
  isSolid: SolidQuery,
  onGround: boolean,
): void {
  if (delta === 0) return;
  const clipped = clipDelta(pos, size, axis, delta, isSolid);
  if (!blocked(delta, clipped) || !onGround) {
    pos[axis] += clipped;
    if (blocked(delta, clipped)) velocity[axis] = 0;
    return;
  }

  const up = clipDelta(pos, size, "y", STEP_HEIGHT, isSolid);
  if (up <= EPS) {
    pos[axis] += clipped;
    velocity[axis] = 0;
    return;
  }

  pos.y += up;
  const stepped = clipDelta(pos, size, axis, delta, isSolid);
  if (Math.abs(stepped) > Math.abs(clipped) + 1e-4) {
    pos[axis] += stepped;
    pos.y += clipDelta(pos, size, "y", -up, isSolid);
    if (blocked(delta, stepped)) velocity[axis] = 0;
    return;
  }

  pos.y -= up;
  pos[axis] += clipped;
  velocity[axis] = 0;
}

function standingOnGround(pos: Vec3, size: BodySize, isSolid: SolidQuery): boolean {
  const probe = -0.05;
  return clipDelta(pos, size, "y", probe, isSolid) > probe + 1e-4;
}

function moveOnce(
  pos: Vec3,
  velocity: Vec3,
  size: BodySize,
  dt: number,
  isSolid: SolidQuery,
  onGround: boolean,
): boolean {
  moveHorizontal(pos, velocity, size, "x", velocity.x * dt, isSolid, onGround);
  moveHorizontal(pos, velocity, size, "z", velocity.z * dt, isSolid, onGround);
  const dy = velocity.y * dt;
  const clippedY = clipDelta(pos, size, "y", dy, isSolid);
  pos.y += clippedY;
  if (blocked(dy, clippedY)) {
    velocity.y = 0;
    return dy < 0;
  }
  if (dy !== 0) return false;
  return standingOnGround(pos, size, isSolid);
}

/** Integrate velocity, resolve solids per axis, and step up a single block. */
export function moveBody(
  pos: Vec3,
  velocity: Vec3,
  size: BodySize,
  dt: number,
  isSolid: SolidQuery,
  wasOnGround: boolean,
): { onGround: boolean } {
  const distance = Math.hypot(velocity.x, velocity.y, velocity.z) * dt;
  const steps = Math.max(1, Math.ceil(distance / MAX_SUBSTEP));
  const h = dt / steps;
  let onGround = wasOnGround;
  for (let i = 0; i < steps; i++) {
    onGround = moveOnce(pos, velocity, size, h, isSolid, onGround);
  }
  return { onGround };
}
