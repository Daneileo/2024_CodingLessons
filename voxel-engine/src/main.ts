import {
  DEFAULT_RENDER_DISTANCE,
  DEFAULT_SEED,
  FLY_SPEED,
  GRAVITY,
  JUMP_SPEED,
  PLAYER_EYE,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  TERMINAL_VELOCITY,
  WALK_SPEED,
} from "./core/constants";
import { Aabb, Gravity, PlayerController, Transform, Velocity } from "./ecs/components";
import { PhysicsSystem } from "./ecs/systems/physics";
import { PlayerInputSystem } from "./ecs/systems/player-input";
import { EcsWorldImpl } from "./ecs/world";
import { loadGameData } from "./registry/load-data";
import { bindInput, createInput } from "./render/input";
import { VoxelRenderer } from "./render/renderer";
import { ChunkManager } from "./world/chunk-manager";
import { worldToChunk } from "./world/coords";
import { findLandSpawn, inspectColumn } from "./world/generator";
import "./style.css";

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.querySelector<T>(`#${id}`);
  if (!element) throw new Error(`missing #${id}`);
  return element;
}

async function main(): Promise<void> {
  const canvas = requireElement<HTMLCanvasElement>("view");
  const loader = requireElement<HTMLDivElement>("loader");
  const pause = requireElement<HTMLDivElement>("pause");
  const crosshair = requireElement<HTMLDivElement>("crosshair");
  const hud = requireElement<HTMLPreElement>("hud");

  const data = loadGameData();
  const renderer = new VoxelRenderer(canvas);
  const input = createInput();
  bindInput(canvas, pause, crosshair, input);
  window.addEventListener("resize", () => renderer.resize());

  const workers = Math.min(4, navigator.hardwareConcurrency || 2);
  const chunks = new ChunkManager(renderer.scene, data.blocks, DEFAULT_SEED, DEFAULT_RENDER_DISTANCE, workers);
  const spawn = findLandSpawn(DEFAULT_SEED, data.biomes);
  const spawnChunk = worldToChunk(spawn.x, spawn.z);

  const ecs = new EcsWorldImpl();
  const player = ecs.createEntity();
  ecs.add(player, Transform, { x: spawn.x, y: 200, z: spawn.z, yaw: input.yaw, pitch: input.pitch });
  ecs.add(player, Velocity, { x: 0, y: 0, z: 0 });
  ecs.add(player, Aabb, { width: PLAYER_WIDTH, height: PLAYER_HEIGHT, depth: PLAYER_WIDTH });
  ecs.add(player, PlayerController, {
    walkSpeed: WALK_SPEED,
    flySpeed: FLY_SPEED,
    jumpSpeed: JUMP_SPEED,
    flying: false,
    onGround: false,
  });
  ecs.add(player, Gravity, { acceleration: GRAVITY, terminal: TERMINAL_VELOCITY });
  ecs.addSystem(new PlayerInputSystem(input));
  ecs.addSystem(new PhysicsSystem(chunks));

  loader.textContent = "Generating the spawn columns…";
  await chunks.preload(spawnChunk.cx, spawnChunk.cz, 1);
  const transform = ecs.get(player, Transform);
  if (!transform) throw new Error("player transform missing");
  transform.y = chunks.spawnHeight(spawn.x, spawn.z);

  loader.hidden = true;
  let last = performance.now();
  let fps = 0;

  const frame = (now: number): void => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    fps = fps === 0 ? 1 / Math.max(dt, 0.001) : fps * 0.9 + (1 / Math.max(dt, 0.001)) * 0.1;
    ecs.tick(dt);
    const body = ecs.get(player, Transform);
    const controller = ecs.get(player, PlayerController);
    if (body) {
      renderer.look(body.x, body.y + PLAYER_EYE, body.z, body.yaw, body.pitch);
      chunks.update(renderer.camera.position, renderer.viewProjectionElements());
      const info = inspectColumn(body.x, body.z, DEFAULT_SEED, data.biomes);
      const chunk = worldToChunk(body.x, body.z);
      const mode = controller?.flying ? "fly" : controller?.onGround ? "ground" : "air";
      hud.textContent = [
        `xyz  ${body.x.toFixed(1)}  ${body.y.toFixed(1)}  ${body.z.toFixed(1)}`,
        `chunk  ${chunk.cx}  ${chunk.cz}    ${mode}`,
        `biome  ${info.biomeId}    surface ${info.surfaceY}`,
        `loaded ${chunks.stats.loaded}   queued ${chunks.stats.queued}   visible ${chunks.stats.visibleSections}`,
        `fps ${fps.toFixed(0)}`,
      ].join("\n");
    }
    renderer.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

main().catch((error: unknown) => {
  const loader = document.querySelector<HTMLDivElement>("#loader");
  const message = error instanceof Error ? error.message : String(error);
  if (loader) {
    loader.hidden = false;
    loader.textContent = message;
  }
  console.error(error);
});
