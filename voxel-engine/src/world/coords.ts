import { CHUNK_SIZE_X, CHUNK_SIZE_Z, SECTION_HEIGHT, WORLD_MIN_Y } from "../core/constants";
import type { ChunkCoord } from "../core/interfaces";

export function worldToChunk(x: number, z: number): ChunkCoord {
  const cx = Math.floor(x / CHUNK_SIZE_X);
  const cz = Math.floor(z / CHUNK_SIZE_Z);
  return {
    cx,
    cz,
    lx: Math.floor(x) - cx * CHUNK_SIZE_X,
    lz: Math.floor(z) - cz * CHUNK_SIZE_Z,
  };
}

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export function sectionIndex(worldY: number): number {
  return (Math.floor(worldY) - WORLD_MIN_Y) >> 4;
}

export function sectionOriginY(index: number): number {
  return WORLD_MIN_Y + index * SECTION_HEIGHT;
}

export function localSectionY(worldY: number): number {
  return (Math.floor(worldY) - WORLD_MIN_Y) & 15;
}

export function sectionCellIndex(localX: number, localY: number, localZ: number): number {
  return localX + (localZ << 4) + (localY << 8);
}
