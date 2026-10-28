export interface BodySize {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
}

export interface Aabb {
  readonly minX: number;
  readonly minY: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly maxZ: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Feet at pos.y. The box is centered on x and z. */
export function bodyAabb(pos: Vec3, size: BodySize): Aabb {
  const hx = size.width / 2;
  const hz = size.depth / 2;
  return {
    minX: pos.x - hx,
    maxX: pos.x + hx,
    minY: pos.y,
    maxY: pos.y + size.height,
    minZ: pos.z - hz,
    maxZ: pos.z + hz,
  };
}

export function aabbIntersects(a: Aabb, b: Aabb): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY && a.minZ < b.maxZ && a.maxZ > b.minZ;
}
