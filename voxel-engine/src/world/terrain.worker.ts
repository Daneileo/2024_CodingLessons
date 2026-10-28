import { loadGameData } from "../registry/load-data";
import { encodeSections } from "./codec";
import { generateColumn } from "./generator";
import type { TerrainJob, TerrainResult } from "./protocol";

const data = loadGameData();

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<TerrainJob>) => void) | null;
  postMessage: (message: TerrainResult, transfer: Transferable[]) => void;
};

scope.onmessage = (event) => {
  const { jobId, cx, cz, seed } = event.data;
  const sections = generateColumn(cx, cz, seed, data.blocks, data.biomes);
  const buffer = encodeSections(sections);
  scope.postMessage({ jobId, cx, cz, buffer }, [buffer]);
};
