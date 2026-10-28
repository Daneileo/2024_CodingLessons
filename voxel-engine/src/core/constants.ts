/** Inclusive world column. 384 blocks tall, matching a modern voxel column. */
export const WORLD_MIN_Y = -64;
export const WORLD_MAX_Y = 319;
export const CHUNK_HEIGHT = WORLD_MAX_Y - WORLD_MIN_Y + 1;

export const CHUNK_SIZE_X = 16;
export const CHUNK_SIZE_Z = 16;
export const SECTION_HEIGHT = 16;
export const SECTION_COUNT_Y = CHUNK_HEIGHT / SECTION_HEIGHT;

export const SEA_LEVEL = 63;

export const DEFAULT_RENDER_DISTANCE = 6;
export const DEFAULT_SEED = 1337;

export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_EYE = 1.62;
export const WALK_SPEED = 4.4;
export const FLY_SPEED = 16;
export const JUMP_SPEED = 8.6;
export const GRAVITY = 28;
export const TERMINAL_VELOCITY = -60;
