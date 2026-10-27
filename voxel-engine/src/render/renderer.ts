import * as THREE from "three";
import { DEFAULT_RENDER_DISTANCE } from "../core/constants";

const SKY = 0x8ec6ea;

export class VoxelRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private readonly viewProjection = new THREE.Matrix4();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(SKY);
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.08, 900);
    this.scene.fog = new THREE.Fog(SKY, 40, DEFAULT_RENDER_DISTANCE * 16 * 0.95);
    const sun = new THREE.DirectionalLight(0xfff6e8, 1.05);
    sun.position.set(60, 140, 40);
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xd7ecff, 0x7d6a52, 0.55));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.28));
    this.resize();
  }

  resize(): void {
    const width = window.innerWidth;
    const height = Math.max(1, window.innerHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  look(x: number, eyeY: number, z: number, yaw: number, pitch: number): void {
    this.camera.position.set(x, eyeY, z);
    const cosPitch = Math.cos(pitch);
    this.camera.lookAt(x - Math.sin(yaw) * cosPitch, eyeY + Math.sin(pitch), z - Math.cos(yaw) * cosPitch);
    this.camera.updateMatrixWorld();
    this.viewProjection.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
  }

  viewProjectionElements(): ArrayLike<number> {
    return this.viewProjection.elements;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
