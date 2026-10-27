import { SECTION_COUNT_Y } from "../core/constants";

/** Sparse section mask plus raw Uint16 cells. Suitable for worker transfer. */
export function encodeSections(sections: Array<Uint16Array | null>): ArrayBuffer {
  let mask = 0;
  let count = 0;
  for (let i = 0; i < SECTION_COUNT_Y; i++) {
    if (!sections[i]) continue;
    mask |= 1 << i;
    count++;
  }
  const buffer = new ArrayBuffer(4 + count * 8192);
  const view = new DataView(buffer);
  view.setUint32(0, mask, true);
  let offset = 4;
  for (let i = 0; i < SECTION_COUNT_Y; i++) {
    const section = sections[i];
    if (!section) continue;
    new Uint16Array(buffer, offset, 4096).set(section);
    offset += 8192;
  }
  return buffer;
}

export function decodeSections(buffer: ArrayBuffer): Array<Uint16Array | null> {
  const view = new DataView(buffer);
  const mask = view.getUint32(0, true);
  const sections: Array<Uint16Array | null> = new Array(SECTION_COUNT_Y).fill(null);
  let offset = 4;
  for (let i = 0; i < SECTION_COUNT_Y; i++) {
    if ((mask & (1 << i)) === 0) continue;
    sections[i] = new Uint16Array(buffer.slice(offset, offset + 8192));
    offset += 8192;
  }
  return sections;
}
