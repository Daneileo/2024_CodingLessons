import type { BlockDefinition, BlockRegistry, BlockState } from "../core/interfaces";

const STATE_LIMIT = 65536;

function enumerate(definition: BlockDefinition): Array<Record<string, string>> {
  let combos: Array<Record<string, string>> = [{}];
  for (const property of definition.properties) {
    const next: Array<Record<string, string>> = [];
    for (const combo of combos) {
      for (const value of property.values) {
        next.push({ ...combo, [property.name]: value });
      }
    }
    combos = next;
  }
  return combos;
}

function stateKey(id: string, values: Readonly<Record<string, string>>): string {
  const names = Object.keys(values).sort();
  let key = id;
  for (const name of names) key += `|${name}=${values[name]}`;
  return key;
}

export class BlockRegistryImpl implements BlockRegistry {
  readonly airStateId = 0;
  private frozenFlag = false;
  private readonly definitionsById = new Map<string, BlockDefinition>();
  private readonly states: BlockState[] = [];
  private readonly keys = new Map<string, number>();

  get frozen(): boolean {
    return this.frozenFlag;
  }

  get stateCount(): number {
    return this.states.length;
  }

  register(definition: BlockDefinition): void {
    if (this.frozenFlag) throw new Error("block registry is frozen");
    if (this.definitionsById.has(definition.id)) {
      throw new Error(`duplicate block ${definition.id}`);
    }
    if (definition.id !== "strata:air" && this.states.length === 0) {
      throw new Error("register strata:air before any other block");
    }
    const combos = enumerate(definition);
    for (const values of combos) {
      const stateId = this.states.length;
      if (stateId >= STATE_LIMIT) {
        throw new Error("block state id space is full (65536 states)");
      }
      this.states.push({ stateId, block: definition, values });
      this.keys.set(stateKey(definition.id, values), stateId);
    }
    this.definitionsById.set(definition.id, definition);
  }

  freeze(): void {
    if (this.states.length === 0) throw new Error("cannot freeze an empty block registry");
    this.frozenFlag = true;
  }

  getDefinition(id: string): BlockDefinition | undefined {
    return this.definitionsById.get(id);
  }

  getState(stateId: number): BlockState | undefined {
    return this.states[stateId];
  }

  resolve(id: string, values: Readonly<Record<string, string>> = {}): number {
    const definition = this.definitionsById.get(id);
    if (!definition) throw new Error(`unknown block ${id}`);
    const merged: Record<string, string> = { ...definition.defaultState };
    for (const [name, value] of Object.entries(values)) {
      const property = definition.properties.find((entry) => entry.name === name);
      if (!property) throw new Error(`unknown property ${name} on ${id}`);
      if (!property.values.includes(value)) throw new Error(`bad value ${value} for ${id}.${name}`);
      merged[name] = value;
    }
    const stateId = this.keys.get(stateKey(id, merged));
    if (stateId === undefined) throw new Error(`unresolved state ${stateKey(id, merged)}`);
    return stateId;
  }

  isSolid(stateId: number): boolean {
    return this.states[stateId]?.block.solid ?? false;
  }

  isCollidable(stateId: number): boolean {
    return this.states[stateId]?.block.collidable ?? false;
  }

  definitions(): Iterable<BlockDefinition> {
    return this.definitionsById.values();
  }
}
