import type { BlockRegistry } from "../core/interfaces";

export interface MeshBuffers {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly colors: Float32Array;
  readonly indices: Uint32Array;
}

export interface SectionMeshData {
  readonly opaque: MeshBuffers | null;
  readonly translucent: MeshBuffers | null;
}

interface Face {
  readonly normal: readonly [number, number, number];
  readonly shade: number;
  readonly vertices: readonly (readonly [number, number, number])[];
}

const FACES: readonly Face[] = [
  { normal: [0, 1, 0], shade: 1, vertices: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { normal: [0, -1, 0], shade: 0.5, vertices: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]] },
  { normal: [1, 0, 0], shade: 0.74, vertices: [[1, 0, 1], [1, 1, 1], [1, 1, 0], [1, 0, 0]] },
  { normal: [-1, 0, 0], shade: 0.74, vertices: [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]] },
  { normal: [0, 0, 1], shade: 0.88, vertices: [[0, 0, 1], [0, 1, 1], [1, 1, 1], [1, 0, 1]] },
  { normal: [0, 0, -1], shade: 0.88, vertices: [[1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 0]] },
];

function variation(x: number, y: number, z: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  const fract = n - Math.floor(n);
  return 0.93 + fract * 0.07;
}

class Bucket {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly colors: number[] = [];
  readonly indices: number[] = [];

  add(face: Face, lx: number, y: number, lz: number, tint: readonly [number, number, number], vary: number): void {
    const start = this.positions.length / 3;
    const shade = face.shade * vary;
    for (const vertex of face.vertices) {
      this.positions.push(lx + vertex[0], y + vertex[1], lz + vertex[2]);
      this.normals.push(face.normal[0], face.normal[1], face.normal[2]);
      this.colors.push(tint[0] * shade, tint[1] * shade, tint[2] * shade);
    }
    this.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }

  build(): MeshBuffers | null {
    if (this.indices.length === 0) return null;
    return {
      positions: Float32Array.from(this.positions),
      normals: Float32Array.from(this.normals),
      colors: Float32Array.from(this.colors),
      indices: Uint32Array.from(this.indices),
    };
  }
}

function exposed(registry: BlockRegistry, currentId: number, neighborId: number): boolean {
  const current = registry.getState(currentId);
  if (!current || current.block.opacity === "invisible") return false;
  const neighbor = registry.getState(neighborId);
  if (!neighbor || neighbor.block.opacity === "invisible") return true;
  const self = current.block;
  const other = neighbor.block;
  if (self.solid && !other.solid) return true;
  if (self.opacity === "translucent" && other.opacity !== "translucent" && !other.solid) return true;
  if (self.opacity === "cutout" && other.id !== self.id && !other.solid) return true;
  return false;
}

/** Emit exposed faces for one 16³ section. X/Z are chunk-local; Y is absolute. */
export function meshSection(
  originX: number,
  sectionY: number,
  originZ: number,
  sample: (worldX: number, worldY: number, worldZ: number) => number,
  registry: BlockRegistry,
): SectionMeshData {
  const opaque = new Bucket();
  const translucent = new Bucket();
  for (let ly = 0; ly < 16; ly++) {
    const y = sectionY + ly;
    for (let lz = 0; lz < 16; lz++) {
      for (let lx = 0; lx < 16; lx++) {
        const worldX = originX + lx;
        const worldZ = originZ + lz;
        const stateId = sample(worldX, y, worldZ);
        const state = registry.getState(stateId);
        if (!state || state.block.opacity === "invisible") continue;
        const vary = variation(worldX, y, worldZ);
        const bucket = state.block.opacity === "translucent" ? translucent : opaque;
        for (const face of FACES) {
          const neighbor = sample(worldX + face.normal[0], y + face.normal[1], worldZ + face.normal[2]);
          if (!exposed(registry, stateId, neighbor)) continue;
          bucket.add(face, lx, y, lz, state.block.tint, vary);
        }
      }
    }
  }
  return { opaque: opaque.build(), translucent: translucent.build() };
}
