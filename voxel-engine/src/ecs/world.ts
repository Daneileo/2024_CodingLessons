import type { ComponentType, EntityId, EcsWorld, System } from "../core/interfaces";

export class EcsWorldImpl implements EcsWorld {
  private nextId: EntityId = 1;
  private readonly living = new Set<EntityId>();
  private readonly stores = new Map<number, Map<EntityId, unknown>>();
  private readonly systems: System[] = [];

  createEntity(): EntityId {
    const id = this.nextId++;
    this.living.add(id);
    return id;
  }

  destroyEntity(entity: EntityId): void {
    if (!this.living.delete(entity)) return;
    for (const store of this.stores.values()) store.delete(entity);
  }

  alive(entity: EntityId): boolean {
    return this.living.has(entity);
  }

  add<T>(entity: EntityId, component: ComponentType<T>, value: T): void {
    this.write(entity, component, value);
  }

  set<T>(entity: EntityId, component: ComponentType<T>, value: T): void {
    this.write(entity, component, value);
  }

  get<T>(entity: EntityId, component: ComponentType<T>): T | undefined {
    return this.store(component).get(entity);
  }

  has(entity: EntityId, component: ComponentType<unknown>): boolean {
    return this.store(component).has(entity);
  }

  remove(entity: EntityId, component: ComponentType<unknown>): void {
    this.store(component).delete(entity);
  }

  query(components: readonly ComponentType<unknown>[]): Iterable<EntityId> {
    if (components.length === 0) return [...this.living];
    let smallest = this.store(components[0]);
    for (const component of components) {
      const candidate = this.store(component);
      if (candidate.size < smallest.size) smallest = candidate;
    }
    const matches: EntityId[] = [];
    for (const entity of smallest.keys()) {
      if (!this.living.has(entity)) continue;
      if (components.every((component) => this.store(component).has(entity))) matches.push(entity);
    }
    return matches;
  }

  addSystem(system: System): void {
    this.systems.push(system);
  }

  tick(dt: number): void {
    for (const system of this.systems) system.update(dt, this);
  }

  private write<T>(entity: EntityId, component: ComponentType<T>, value: T): void {
    if (!this.living.has(entity)) throw new Error(`entity ${entity} is not alive`);
    this.store(component).set(entity, value);
  }

  private store<T>(component: ComponentType<T>): Map<EntityId, T> {
    let found = this.stores.get(component.id);
    if (!found) {
      found = new Map();
      this.stores.set(component.id, found);
    }
    return found as Map<EntityId, T>;
  }
}
