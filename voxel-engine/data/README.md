# Strata data

Block, item, and biome records are JSON. The loader (`src/registry/load-data.ts`) reads every file in these folders, so a new record is a new file. Ids are namespaced `strata:snake_name`. State 0 is always `data/blocks/air.json`.

```
data/
  blocks/          one file per block type
    air.json
    stone.json
    grass_block.json
    oak_log.json   properties expand into extra states
    glowstone.json luminance is data, not a special case in the generator
  items/           one file per item
    stone.json     "places" points at a block id
    stick.json     "places": null is a non-block item
  biomes/          surface rules for the climate selector
    plains.json
    forest.json
    desert.json
    ocean.json
    mountains.json
    snowy_peaks.json
  textures/        not wired yet
    blocks/        pngs named by the texture keys in block JSON
```

## Block record

| Field | Role |
| --- | --- |
| `id` | `namespace:name` |
| `properties` | Optional list of `{ name, values }`. The registry builds the cartesian product. Last property cycles fastest. Cap is 65535 packed states across every block. |
| `default` | Required when properties exist. Generator and items use this unless they pass overrides. |
| `opacity` | `solid`, `cutout`, `translucent`, or `invisible`. The mesher uses it for face culling and the water bucket. |
| `luminance` | Integer 0 through 15. Stored for the lighting pass; not sampled yet. |
| `hardness` | Seconds-scale break time input. Negative means unbreakable (`strata:bedrock`). |
| `tool` | `{ kind, tier }`. Kind is `none`, `pickaxe`, `shovel`, `axe`, or `hoe`. Tier 0 is the lowest tool. |
| `collidable` | AABB physics. Water is false. |
| `solid` | Hides neighboring faces and blocks light later. Leaves are collidable but not solid. |
| `replaceable` | Air and water can be overwritten by a future place action. |
| `tint` | `#rrggbb`. The current mesher multiplies this into vertex color. |
| `textures` | Face keys: `all`, `top`, `bottom`, `side`, `north`, `south`, `east`, `west`. Values are paths such as `blocks/grass_top` (no extension). |
| `drops` | Item id, or null. |

`strata:grass_block` (`snowy`) and `strata:oak_log` (`axis`) are the property examples. Adding a block the terrain should place also means naming it from `src/world/generator.ts`. A block that only needs to exist, such as `strata:glowstone`, is JSON only.

## Item record

| Field | Role |
| --- | --- |
| `id` | `namespace:name` |
| `maxStack` | Integer 1 through 64 |
| `places` | Block id, or null |
| `tint` | `#rrggbb` icon color until item textures exist |

## Biome record

| Field | Role |
| --- | --- |
| `surface`, `subsurface`, `filler` | Block ids. `filler` is the deep column. `subsurface` is the four blocks under the surface. |
| `underwaterSurface` | Surface used when the column is below sea level (63). |
| `temperature`, `humidity` | 0..1. Climate biomes pick the nearest pair. |
| `trees` | When true, the generator may plant an oak inside the chunk. |
| `selection` | `climate` joins the nearest-match set. `special` is chosen by continentalness (`ocean`, `mountains`, `snowy_peaks`). |

Those three special ids are required. The loader rejects a biome that names a missing block, and an item whose `places` id is missing.
