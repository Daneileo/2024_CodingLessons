# Strata

Strata is a from-scratch voxel engine. It is not Minecraft and it does not ship Mojang assets. The foundation copies the *shape* of that kind of game: namespaced block states, 16×384 columns, multi-layer noise, frustum-culled section meshes, and AABB bodies on an entity world.

The stack is TypeScript, Vite, and Three.js. This repo also holds an unrelated Java lesson project; Strata lives entirely under `voxel-engine/`.

## Run

```bash
cd voxel-engine
npm install
npm test
npm run dev
```

Open the dev server, click the view, then walk. `F` toggles fly. The first screen waits until a 3×3 of columns around a dry spawn has generated.

## Layout

```
voxel-engine/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  data/                         JSON the registries load (see data/README.md)
    blocks/
    items/
    biomes/
  src/
    main.ts                     window, player, frame loop
    core/
      constants.ts              column size, sea level, player body
      interfaces.ts             BlockRegistry, TerrainGenerator, EcsWorld, VoxelWorldView
      math/                     AABB resolve, frustum planes
    registry/                   parse JSON, pack states, load data
    world/
      noise.ts                  seeded value noise
      climate.ts                temperature, humidity, continentalness, erosion, weirdness
      generator.ts              biomes, caves, ores, trees
      chunk.ts                  24 sparse 16³ sections
      codec.ts                  worker transfer format
      terrain.worker.ts         async generation
      chunk-manager.ts          stream, mesh, frustum-cull
      mesher.ts                 exposed faces, opaque vs water
    ecs/
      world.ts
      components.ts             Transform, Velocity, Aabb, PlayerController, Gravity
      systems/                  input wish, physics
    render/                     Three.js view and pointer-lock input
  tests/
```

## Systems

**Block registry.** Each JSON file is one block type. Properties expand into packed state ids. State 0 is air. Sections store `Uint16`, so the whole game has 65535 non-air states. `isSolid` drives the mesher; `isCollidable` drives physics. Hardness, tool, luminance, opacity, and texture keys are on the definition even where a later pass is the first consumer (lighting, breaking, atlases).

**Columns and terrain.** A column is 16×384×16, Y from -64 to 319, split into 24 sections. Empty sections stay `null`. Workers run `NoiseTerrainGenerator`: continentalness and erosion set the height, temperature and humidity pick the biome, 3D noise cuts caves, and a second 3D noise places ore. The main thread meshes a couple of dirty columns per frame and tests each section AABB against the camera frustum. Columns outside render distance + 2 are dropped. Missing columns count as solid to physics so the body cannot fall through a hole that has not streamed in.

**Entities.** `EcsWorld` stores components by type and runs systems in order. The player is a transform, a velocity, an AABB, a controller, and a gravity component. `PlayerInputSystem` writes a wish velocity. `PhysicsSystem` integrates gravity and resolves the AABB one axis at a time, including a one-block step. `MobBehavior` and `ChunkStorage` in `interfaces.ts` are the seams for mob brains and saving; neither is implemented.

## Not in this pass

Texture atlas and the `textures` keys, light from `luminance`, greedy meshing, ambient occlusion, fluid flow, block breaking, item use, mob AI, and disk storage. Structures that cross a column edge are clipped so a worker never writes a neighbor.
