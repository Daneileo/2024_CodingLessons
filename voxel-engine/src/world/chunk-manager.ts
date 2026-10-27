import * as THREE from "three";
import { CHUNK_SIZE_X, CHUNK_SIZE_Z, SECTION_COUNT_Y, WORLD_MAX_Y, WORLD_MIN_Y } from "../core/constants";
import type { BlockRegistry, VoxelWorldView } from "../core/interfaces";
import { Frustum } from "../core/math/frustum";
import { Chunk } from "./chunk";
import { decodeSections } from "./codec";
import { chunkKey, sectionOriginY, worldToChunk } from "./coords";
import { meshSection, type MeshBuffers } from "./mesher";
import type { TerrainJob, TerrainResult } from "./protocol";

interface Bounds {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

interface ChunkRecord {
  chunk: Chunk;
  group: THREE.Group;
  meshes: THREE.Mesh[];
  dirty: boolean;
}

interface PendingJob {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
}

export interface ChunkManagerStats {
  loaded: number;
  queued: number;
  visibleSections: number;
}

class WorkerPool {
  private readonly all: Worker[] = [];
  private readonly idle: Worker[] = [];
  private readonly jobs = new Map<Worker, number>();

  constructor(
    count: number,
    private readonly onResult: (worker: Worker, message: TerrainResult) => void,
    private readonly onFailure: (worker: Worker, jobId: number | undefined, error: Error) => void,
  ) {
    for (let i = 0; i < Math.max(1, count); i++) {
      const worker = new Worker(new URL("./terrain.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<TerrainResult>) => {
        this.jobs.delete(worker);
        this.onResult(worker, event.data);
      };
      worker.onerror = (event) => {
        const jobId = this.jobs.get(worker);
        this.jobs.delete(worker);
        this.onFailure(worker, jobId, new Error(event.message || "terrain worker failed"));
      };
      this.all.push(worker);
      this.idle.push(worker);
    }
  }

  take(): Worker | undefined {
    return this.idle.pop();
  }

  release(worker: Worker): void {
    if (this.all.includes(worker)) this.idle.push(worker);
  }

  track(worker: Worker, jobId: number): void {
    this.jobs.set(worker, jobId);
  }

  retire(worker: Worker): void {
    const index = this.all.indexOf(worker);
    if (index >= 0) this.all.splice(index, 1);
    const idleIndex = this.idle.indexOf(worker);
    if (idleIndex >= 0) this.idle.splice(idleIndex, 1);
    worker.terminate();
  }

  dispose(): void {
    for (const worker of this.all) worker.terminate();
    this.all.length = 0;
    this.idle.length = 0;
  }
}

/**
 * Streams columns around a focus point, meshes them on the main thread,
 * and hides sections the camera cannot see.
 */
export class ChunkManager implements VoxelWorldView {
  readonly stats: ChunkManagerStats = { loaded: 0, queued: 0, visibleSections: 0 };
  private readonly records = new Map<string, ChunkRecord>();
  private readonly jobs = new Map<string, PendingJob>();
  private readonly queue: Array<{ cx: number; cz: number }> = [];
  private readonly inflight = new Map<number, { cx: number; cz: number }>();
  private readonly pool: WorkerPool;
  private nextJob = 1;
  private readonly opaqueMaterial: THREE.MeshLambertMaterial;
  private readonly waterMaterial: THREE.MeshLambertMaterial;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly registry: BlockRegistry,
    private readonly seed: number,
    private readonly renderDistance: number,
    workerCount: number,
  ) {
    this.opaqueMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.waterMaterial = new THREE.MeshLambertMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
    });
    this.pool = new WorkerPool(
      workerCount,
      (worker, message) => this.onResult(worker, message),
      (worker, jobId, error) => this.onFailure(worker, jobId, error),
    );
  }

  request(cx: number, cz: number): Promise<void> {
    const key = chunkKey(cx, cz);
    if (this.records.has(key)) return Promise.resolve();
    const existing = this.jobs.get(key);
    if (existing) return existing.promise;
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    this.jobs.set(key, { promise, resolve, reject });
    this.queue.push({ cx, cz });
    this.pump();
    return promise;
  }

  async preload(cx: number, cz: number, radius: number): Promise<void> {
    const tasks: Array<Promise<void>> = [];
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) tasks.push(this.request(cx + dx, cz + dz));
    }
    await Promise.all(tasks);
    this.meshSome(Number.POSITIVE_INFINITY);
  }

  update(focus: THREE.Vector3, viewProjection: ArrayLike<number>): void {
    const center = worldToChunk(focus.x, focus.z);
    const wanted: Array<{ cx: number; cz: number; dist: number }> = [];
    const radius = this.renderDistance;
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dz * dz > radius * radius) continue;
        wanted.push({ cx: center.cx + dx, cz: center.cz + dz, dist: dx * dx + dz * dz });
      }
    }
    wanted.sort((a, b) => a.dist - b.dist);
    for (const entry of wanted) void this.request(entry.cx, entry.cz);
    this.queue.sort((a, b) => {
      const da = (a.cx - center.cx) ** 2 + (a.cz - center.cz) ** 2;
      const db = (b.cx - center.cx) ** 2 + (b.cz - center.cz) ** 2;
      return da - db;
    });
    this.unload(center.cx, center.cz, radius + 2);
    this.pump();
    this.meshSome(2);
    this.cull(viewProjection);
    this.stats.loaded = this.records.size;
    this.stats.queued = this.jobs.size;
  }

  getBlock(worldX: number, worldY: number, worldZ: number): number {
    const y = Math.floor(worldY);
    if (y < WORLD_MIN_Y || y > WORLD_MAX_Y) return 0;
    const coord = worldToChunk(worldX, worldZ);
    const record = this.records.get(chunkKey(coord.cx, coord.cz));
    if (!record) return 0;
    return record.chunk.getBlock(coord.lx, y, coord.lz);
  }

  isSolidAt(worldX: number, worldY: number, worldZ: number): boolean {
    return this.registry.isSolid(this.getBlock(worldX, worldY, worldZ));
  }

  isCollidableAt(worldX: number, worldY: number, worldZ: number): boolean {
    const y = Math.floor(worldY);
    if (y < WORLD_MIN_Y || y > WORLD_MAX_Y) return false;
    const coord = worldToChunk(worldX, worldZ);
    const record = this.records.get(chunkKey(coord.cx, coord.cz));
    if (!record) return true;
    return this.registry.isCollidable(record.chunk.getBlock(coord.lx, y, coord.lz));
  }

  spawnHeight(worldX: number, worldZ: number): number {
    for (let y = WORLD_MAX_Y; y >= WORLD_MIN_Y; y--) {
      if (this.registry.isCollidable(this.getBlock(worldX, y, worldZ))) return y + 1;
    }
    return WORLD_MIN_Y + 1;
  }

  dispose(): void {
    for (const record of this.records.values()) this.disposeRecord(record);
    this.records.clear();
    this.opaqueMaterial.dispose();
    this.waterMaterial.dispose();
    this.pool.dispose();
  }

  private pump(): void {
    for (;;) {
      const worker = this.pool.take();
      if (!worker) return;
      let next: { cx: number; cz: number } | undefined;
      while (this.queue.length > 0) {
        const candidate = this.queue.shift();
        if (!candidate) break;
        const key = chunkKey(candidate.cx, candidate.cz);
        if (this.records.has(key)) {
          this.finish(key);
          continue;
        }
        if (this.isInflight(candidate.cx, candidate.cz)) continue;
        next = candidate;
        break;
      }
      if (!next) {
        this.pool.release(worker);
        return;
      }
      const jobId = this.nextJob++;
      this.inflight.set(jobId, next);
      this.pool.track(worker, jobId);
      const message: TerrainJob = { jobId, cx: next.cx, cz: next.cz, seed: this.seed };
      worker.postMessage(message);
    }
  }

  private isInflight(cx: number, cz: number): boolean {
    for (const job of this.inflight.values()) {
      if (job.cx === cx && job.cz === cz) return true;
    }
    return false;
  }

  private onResult(worker: Worker, message: TerrainResult): void {
    this.pool.release(worker);
    this.inflight.delete(message.jobId);
    const key = chunkKey(message.cx, message.cz);
    if (!this.records.has(key)) {
      const chunk = new Chunk(message.cx, message.cz, decodeSections(message.buffer));
      const group = new THREE.Group();
      group.position.set(message.cx * CHUNK_SIZE_X, 0, message.cz * CHUNK_SIZE_Z);
      this.scene.add(group);
      this.records.set(key, { chunk, group, meshes: [], dirty: true });
      this.markNeighborsDirty(message.cx, message.cz);
    }
    this.finish(key);
    this.pump();
  }

  private onFailure(worker: Worker, jobId: number | undefined, error: Error): void {
    this.pool.retire(worker);
    if (jobId === undefined) return;
    const meta = this.inflight.get(jobId);
    this.inflight.delete(jobId);
    if (!meta) return;
    const key = chunkKey(meta.cx, meta.cz);
    const job = this.jobs.get(key);
    this.jobs.delete(key);
    job?.reject(error);
  }

  private finish(key: string): void {
    const job = this.jobs.get(key);
    if (!job) return;
    this.jobs.delete(key);
    job.resolve();
  }

  private markNeighborsDirty(cx: number, cz: number): void {
    const neighbors = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const;
    for (const [dx, dz] of neighbors) {
      const neighbor = this.records.get(chunkKey(cx + dx, cz + dz));
      if (neighbor) neighbor.dirty = true;
    }
  }

  private unload(cx: number, cz: number, keep: number): void {
    const limit = keep * keep;
    for (const [key, record] of this.records) {
      const dx = record.chunk.cx - cx;
      const dz = record.chunk.cz - cz;
      if (dx * dx + dz * dz <= limit) continue;
      this.disposeRecord(record);
      this.records.delete(key);
    }
  }

  private meshSome(budget: number): void {
    let built = 0;
    for (const record of this.records.values()) {
      if (!record.dirty) continue;
      this.rebuild(record);
      built++;
      if (built >= budget) break;
    }
  }

  private rebuild(record: ChunkRecord): void {
    for (const mesh of record.meshes) {
      mesh.geometry.dispose();
      record.group.remove(mesh);
    }
    record.meshes = [];
    const originX = record.chunk.cx * CHUNK_SIZE_X;
    const originZ = record.chunk.cz * CHUNK_SIZE_Z;
    const sample = (x: number, y: number, z: number) => this.getBlock(x, y, z);
    for (let section = 0; section < SECTION_COUNT_Y; section++) {
      if (!record.chunk.sections[section]) continue;
      const sectionY = sectionOriginY(section);
      const built = meshSection(originX, sectionY, originZ, sample, this.registry);
      if (built.opaque) record.meshes.push(this.toMesh(built.opaque, this.opaqueMaterial, originX, sectionY, originZ));
      if (built.translucent) {
        const mesh = this.toMesh(built.translucent, this.waterMaterial, originX, sectionY, originZ);
        mesh.renderOrder = 2;
        record.meshes.push(mesh);
      }
    }
    for (const mesh of record.meshes) record.group.add(mesh);
    record.dirty = false;
  }

  private toMesh(
    buffers: MeshBuffers,
    material: THREE.Material,
    originX: number,
    sectionY: number,
    originZ: number,
  ): THREE.Mesh {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(buffers.positions, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(buffers.normals, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(buffers.colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(buffers.indices, 1));
    const mesh = new THREE.Mesh(geometry, material);
    const bounds: Bounds = {
      minX: originX,
      minY: sectionY,
      minZ: originZ,
      maxX: originX + CHUNK_SIZE_X,
      maxY: sectionY + 16,
      maxZ: originZ + CHUNK_SIZE_Z,
    };
    mesh.userData.bounds = bounds;
    return mesh;
  }

  private cull(viewProjection: ArrayLike<number>): void {
    const frustum = Frustum.fromMatrix(viewProjection);
    let visible = 0;
    for (const record of this.records.values()) {
      for (const mesh of record.meshes) {
        const bounds = mesh.userData.bounds as Bounds;
        const inside = frustum.intersectsAabb(
          bounds.minX,
          bounds.minY,
          bounds.minZ,
          bounds.maxX,
          bounds.maxY,
          bounds.maxZ,
        );
        mesh.visible = inside;
        if (inside) visible++;
      }
    }
    this.stats.visibleSections = visible;
  }

  private disposeRecord(record: ChunkRecord): void {
    for (const mesh of record.meshes) mesh.geometry.dispose();
    this.scene.remove(record.group);
  }
}
