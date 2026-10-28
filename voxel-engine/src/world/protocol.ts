export interface TerrainJob {
  jobId: number;
  cx: number;
  cz: number;
  seed: number;
}

export interface TerrainResult {
  jobId: number;
  cx: number;
  cz: number;
  buffer: ArrayBuffer;
}
