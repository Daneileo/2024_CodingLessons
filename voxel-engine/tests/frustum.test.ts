import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { Frustum } from "../src/core/math/frustum";

describe("frustum", () => {
  it("rejects a box on the outside of a single plane", () => {
    const frustum = new Frustum([{ a: 0, b: 1, c: 0, d: 0 }]);
    expect(frustum.intersectsAabb(0, -2, 0, 1, -1, 1)).toBe(false);
    expect(frustum.intersectsAabb(0, -0.2, 0, 1, 1, 1)).toBe(true);
  });

  it("matches a perspective camera", () => {
    const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100);
    camera.position.set(0, 2, 12);
    camera.lookAt(0, 1, 0);
    camera.updateMatrixWorld();
    const viewProjection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const frustum = Frustum.fromMatrix(viewProjection.elements);
    expect(frustum.intersectsAabb(-1, 0, -1, 1, 2, 1)).toBe(true);
    expect(frustum.intersectsAabb(-1, 0, 30, 1, 2, 40)).toBe(false);
    expect(frustum.intersectsAabb(40, 0, 0, 50, 2, 2)).toBe(false);
  });
});
