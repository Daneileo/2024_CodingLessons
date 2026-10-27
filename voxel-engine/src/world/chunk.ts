import { SECTION_COUNT_Y } from "../core/constants";
import type { ChunkColumn } from "../core/interfaces";
import { localSectionY, sectionCellIndex, sectionIndex } from "./coords";

export class Chunk implements ChunkColumn {
  readonly sections: Array<Uint16Array | null>;

  constructor(
    readonly cx: number,
    readonly cz: number,
    sections?: Array<Uint16Array | null>,
  ) {
    this.sections = sections ?? new Array<Uint16Array | null>(SECTION_COUNT_Y).fill(null);
    if (this.sections.length !== SECTION_COUNT_Y) {
      throw new Error(`column ${cx},${cz} has ${this.sections.length} sections`);
    }
  }

  getBlock(localX: number, worldY: number, localZ: number): number {
    const lx = Math.floor(localX);
    const lz = Math.floor(localZ);
    if (lx < 0 || lx > 15 || lz < 0 || lz > 15) return 0;
    const si = sectionIndex(worldY);
    const section = this.sections[si];
    if (!section) return 0;
    return section[sectionCellIndex(lx, localSectionY(worldY), lz)];
  }

  setBlock(localX: number, worldY: number, localZ: number, stateId: number): void {
    const lx = Math.floor(localX);
    const lz = Math.floor(localZ);
    const si = sectionIndex(worldY);
    if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || si < 0 || si >= SECTION_COUNT_Y) return;
    let section = this.sections[si];
    const index = sectionCellIndex(lx, localSectionY(worldY), lz);
    if (stateId === 0) {
      if (!section) return;
      section[index] = 0;
      return;
    }
    if (!section) {
      section = new Uint16Array(4096);
      this.sections[si] = section;
    }
    section[index] = stateId;
  }

  /** Drop sections that carving emptied, so the codec stays sparse. */
  compact(): void {
    for (let i = 0; i < this.sections.length; i++) {
      const section = this.sections[i];
      if (!section) continue;
      let occupied = false;
      for (let cell = 0; cell < section.length; cell++) {
        if (section[cell] !== 0) {
          occupied = true;
          break;
        }
      }
      if (!occupied) this.sections[i] = null;
    }
  }
}
