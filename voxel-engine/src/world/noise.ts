function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Deterministic value noise. Samples are in [-1, 1]. */
export class LatticeNoise {
  constructor(private readonly seed: number) {}

  private hash(ix: number, iy: number, iz: number): number {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 1440672751) ^ this.seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  sample2(x: number, z: number): number {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const tx = fade(x - x0);
    const tz = fade(z - z0);
    const v00 = this.hash(x0, 0, z0);
    const v10 = this.hash(x0 + 1, 0, z0);
    const v01 = this.hash(x0, 0, z0 + 1);
    const v11 = this.hash(x0 + 1, 0, z0 + 1);
    return mix(mix(v00, v10, tx), mix(v01, v11, tx), tz) * 2 - 1;
  }

  sample3(x: number, y: number, z: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const z0 = Math.floor(z);
    const tx = fade(x - x0);
    const ty = fade(y - y0);
    const tz = fade(z - z0);
    const v000 = this.hash(x0, y0, z0);
    const v100 = this.hash(x0 + 1, y0, z0);
    const v010 = this.hash(x0, y0 + 1, z0);
    const v110 = this.hash(x0 + 1, y0 + 1, z0);
    const v001 = this.hash(x0, y0, z0 + 1);
    const v101 = this.hash(x0 + 1, y0, z0 + 1);
    const v011 = this.hash(x0, y0 + 1, z0 + 1);
    const v111 = this.hash(x0 + 1, y0 + 1, z0 + 1);
    const x00 = mix(v000, v100, tx);
    const x10 = mix(v010, v110, tx);
    const x01 = mix(v001, v101, tx);
    const x11 = mix(v011, v111, tx);
    return mix(mix(x00, x10, ty), mix(x01, x11, ty), tz) * 2 - 1;
  }

  fbm2(x: number, z: number, octaves: number, frequency: number, lacunarity = 2, gain = 0.5): number {
    let amplitude = 1;
    let sum = 0;
    let weight = 0;
    let freq = frequency;
    for (let octave = 0; octave < octaves; octave++) {
      sum += this.sample2(x * freq, z * freq) * amplitude;
      weight += amplitude;
      amplitude *= gain;
      freq *= lacunarity;
    }
    return sum / weight;
  }

  fbm3(x: number, y: number, z: number, octaves: number, frequency: number, lacunarity = 2, gain = 0.5): number {
    let amplitude = 1;
    let sum = 0;
    let weight = 0;
    let freq = frequency;
    for (let octave = 0; octave < octaves; octave++) {
      sum += this.sample3(x * freq, y * freq, z * freq) * amplitude;
      weight += amplitude;
      amplitude *= gain;
      freq *= lacunarity;
    }
    return sum / weight;
  }
}

export function hashInt(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440672751) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
