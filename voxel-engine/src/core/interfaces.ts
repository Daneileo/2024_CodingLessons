/**
 * Contracts for the three foundation systems:
 * block registry, streamed columns, and the entity world.
 * Implementations live beside these types. Nothing in this file imports them.
 */

export type Opacity = "solid" | "cutout" | "translucent" | "invisible";

export type ToolKind = "none" | "pickaxe" | "shovel" | "axe" | "hoe";

export interface ToolRequirement {
  readonly kind: ToolKind;
  readonly tier: number;
}

export interface BlockProperty {
  readonly name: string;
  readonly values: readonly string[];
}

/** Texture keys are data paths such as "blocks/grass_top". The mesher currently tints by color. */
export interface BlockTextures {
  readonly all?: string;
  readonly top?: string;
  readonly bottom?: string;
  readonly side?: string;
  readonly north?: string;
  readonly south?: string;
  readonly east?: string;
  readonly west?: string;
}

export interface BlockDefinition {
  readonly id: string;
  readonly properties: readonly BlockProperty[];
  readonly defaultState: Readonly<Record<string, string>>;
  readonly opacity: Opacity;
  readonly luminance: number;
  readonly hardness: number;
  readonly tool: ToolRequirement;
  readonly collidable: boolean;
  readonly solid: boolean;
  readonly replaceable: boolean;
  readonly tint: readonly [number, number, number];
  readonly textures: BlockTextures;
  readonly drops: string | null;
}

export interface BlockState {
  readonly stateId: number;
  readonly block: BlockDefinition;
  readonly values: Readonly<Record<string, string>>;
}

/**
 * Packed block states. State 0 is air. The packed id space is 16-bit so a
 * column section can store every block in a Uint16Array.
 */
export interface BlockRegistry {
  readonly frozen: boolean;
  readonly stateCount: number;
  readonly airStateId: number;
  register(definition: BlockDefinition): void;
  freeze(): void;
  getDefinition(id: string): BlockDefinition | undefined;
  getState(stateId: number): BlockState | undefined;
  resolve(id: string, values?: Readonly<Record<string, string>>): number;
  isSolid(stateId: number): boolean;
  isCollidable(stateId: number): boolean;
  definitions(): Iterable<BlockDefinition>;
}

export interface ItemDefinition {
  readonly id: string;
  readonly maxStack: number;
  /** Block id this item places, when it is a block item. */
  readonly places: string | null;
  readonly tint: readonly [number, number, number];
}

export interface ItemRegistry {
  readonly count: number;
  register(definition: ItemDefinition): void;
  get(id: string): ItemDefinition | undefined;
  items(): Iterable<ItemDefinition>;
}

export interface BiomeDefinition {
  readonly id: string;
  readonly surface: string;
  readonly subsurface: string;
  readonly filler: string;
  readonly underwaterSurface: string;
  readonly temperature: number;
  readonly humidity: number;
  readonly trees: boolean;
  readonly selection: "climate" | "special";
}

export interface ClimateSample {
  readonly temperature: number;
  readonly humidity: number;
  readonly continentalness: number;
  readonly erosion: number;
  readonly weirdness: number;
  readonly detail: number;
}

export interface ChunkCoord {
  readonly cx: number;
  readonly cz: number;
  readonly lx: number;
  readonly lz: number;
}

/** One 16×384×16 column. Sections are null when the 16³ slice is entirely air. */
export interface ChunkColumn {
  readonly cx: number;
  readonly cz: number;
  getBlock(localX: number, worldY: number, localZ: number): number;
  setBlock(localX: number, worldY: number, localZ: number, stateId: number): void;
}

export interface TerrainGenerator {
  readonly seed: number;
  generate(cx: number, cz: number): Array<Uint16Array | null>;
}

/** Read-only world used by physics and, later, mob behaviors. */
export interface VoxelWorldView {
  getBlock(worldX: number, worldY: number, worldZ: number): number;
  isSolidAt(worldX: number, worldY: number, worldZ: number): boolean;
  isCollidableAt(worldX: number, worldY: number, worldZ: number): boolean;
}

/** Persistence seam. Streaming does not depend on a disk format yet. */
export interface ChunkStorage {
  load(cx: number, cz: number): Promise<Uint8Array | null>;
  save(cx: number, cz: number, encoded: Uint8Array): Promise<void>;
}

export type EntityId = number;

export interface ComponentType<T> {
  readonly id: number;
  readonly name: string;
  readonly _brand?: T;
}

export interface EcsWorld {
  createEntity(): EntityId;
  destroyEntity(entity: EntityId): void;
  alive(entity: EntityId): boolean;
  add<T>(entity: EntityId, component: ComponentType<T>, value: T): void;
  get<T>(entity: EntityId, component: ComponentType<T>): T | undefined;
  set<T>(entity: EntityId, component: ComponentType<T>, value: T): void;
  has(entity: EntityId, component: ComponentType<unknown>): boolean;
  remove(entity: EntityId, component: ComponentType<unknown>): void;
  query(components: readonly ComponentType<unknown>[]): Iterable<EntityId>;
  addSystem(system: System): void;
  tick(dt: number): void;
}

export interface System {
  readonly name: string;
  update(dt: number, world: EcsWorld): void;
}

/** Future mob brains sit on top of the same world and voxel view. */
export interface MobBehavior {
  readonly id: string;
  tick(entity: EntityId, ecs: EcsWorld, voxels: VoxelWorldView, dt: number): void;
}

export interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sneak: boolean;
  flying: boolean;
  yaw: number;
  pitch: number;
}
