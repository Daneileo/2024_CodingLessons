export interface Plane {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
}

function combine(rowA: readonly number[], rowB: readonly number[], sign: 1 | -1): [number, number, number, number] {
  return [rowA[0] + sign * rowB[0], rowA[1] + sign * rowB[1], rowA[2] + sign * rowB[2], rowA[3] + sign * rowB[3]];
}

function normalize(row: [number, number, number, number]): Plane {
  const length = Math.hypot(row[0], row[1], row[2]) || 1;
  return { a: row[0] / length, b: row[1] / length, c: row[2] / length, d: row[3] / length };
}

/**
 * Six clip planes extracted from a column-major view-projection matrix.
 * The test is the standard p-vertex AABB check.
 */
export class Frustum {
  constructor(readonly planes: readonly Plane[]) {}

  static fromMatrix(elements: ArrayLike<number>): Frustum {
    const e = elements;
    const row0 = [e[0], e[4], e[8], e[12]];
    const row1 = [e[1], e[5], e[9], e[13]];
    const row2 = [e[2], e[6], e[10], e[14]];
    const row3 = [e[3], e[7], e[11], e[15]];
    return new Frustum([
      normalize(combine(row3, row0, 1)),
      normalize(combine(row3, row0, -1)),
      normalize(combine(row3, row1, 1)),
      normalize(combine(row3, row1, -1)),
      normalize(combine(row3, row2, 1)),
      normalize(combine(row3, row2, -1)),
    ]);
  }

  intersectsAabb(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): boolean {
    for (const plane of this.planes) {
      const x = plane.a >= 0 ? maxX : minX;
      const y = plane.b >= 0 ? maxY : minY;
      const z = plane.c >= 0 ? maxZ : minZ;
      if (plane.a * x + plane.b * y + plane.c * z + plane.d < 0) return false;
    }
    return true;
  }
}
