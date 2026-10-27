import type { ItemDefinition, ItemRegistry } from "../core/interfaces";

export class ItemRegistryImpl implements ItemRegistry {
  private readonly byId = new Map<string, ItemDefinition>();

  get count(): number {
    return this.byId.size;
  }

  register(definition: ItemDefinition): void {
    if (this.byId.has(definition.id)) throw new Error(`duplicate item ${definition.id}`);
    this.byId.set(definition.id, definition);
  }

  get(id: string): ItemDefinition | undefined {
    return this.byId.get(id);
  }

  items(): Iterable<ItemDefinition> {
    return this.byId.values();
  }
}
