import Stats from "stats.js";
import {
  WebGLRenderer,
  PerspectiveCamera,
  Matrix4,
  Scene,
  HemisphereLight,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { Loader } from "./Loader";
import { RenderBatch } from "./RenderBatch";

class ModelRenderer {
  private _container: HTMLDivElement;
  private _stats: Stats;
  private _scene: Scene;
  private _loader: Loader;
  private _renderBatches: Array<RenderBatch>;
  private _currentRenderBatch: RenderBatch | null;
  private _renderer: WebGLRenderer;
  private _camera: PerspectiveCamera;
  private _lastCameraTransform: Matrix4;
  private _lastCameraMovedStatus: boolean;
  private _drawCoroutine: Generator<void, void, void> | null;

  public constructor(container: HTMLDivElement) {
    this._container = container;

    // init stats
    this._stats = new Stats();
    this._stats.showPanel(0);
    this._container.appendChild(this._stats.dom);

    // init scene
    this._scene = new Scene();
    const light = new HemisphereLight(0xffffff, 0x080808, 1);
    this._scene.add(light);

    // init loader
    this._loader = new Loader();
    this._renderBatches = [];
    this._currentRenderBatch = null;

    // init renderer
    this._renderer = new WebGLRenderer({
      preserveDrawingBuffer: true,
      antialias: true,
    });
    this._renderer.autoClear = false;
    this._renderer.autoClearColor = false;
    this._renderer.autoClearDepth = false;
    this._renderer.autoClearStencil = false;
    this._renderer.setSize(this.width, this.height);
    this._container.appendChild(this._renderer.domElement);

    // init camera
    this._camera = new PerspectiveCamera(
      75,
      this.width / this.height,
      0.1,
      1000
    );
    this._camera.position.z = 5;
    this._lastCameraTransform = new Matrix4().copy(this._camera.matrixWorld);
    this._lastCameraMovedStatus = false;
    new OrbitControls(this._camera, this._renderer.domElement);

    this._drawCoroutine = null;

    window.addEventListener("resize", this._onWindowResize.bind(this));
    this._render();
  }

  get width(): number {
    return this._container ? this._container.clientWidth : 0;
  }

  get height(): number {
    return this._container ? this._container.clientHeight : 0;
  }

  public clear() {}

  public async load(vbimFileId: string) {
    await this._loader.load(vbimFileId);
    this._renderBatches = this._renderBatches.concat(
      this._loader.getRenderBatches()
    );
    this._drawProgressivelyAbort();
    this._drawEveryFrame();
    this._drawCoroutine = this._drawProgressively();
  }

  public dispose() {
    this._renderer.dispose();
    window.removeEventListener("resize", this._onWindowResize.bind(this));
  }

  private _onWindowResize(): void {
    this._camera.aspect = this.width / this.height;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(this.width, this.height);
  }

  private _isCameraMovingOrJustStop(): { moving: boolean; justStop: boolean } {
    var cameraTransform = new Matrix4().copy(this._camera.matrixWorld);
    var moving = !cameraTransform.equals(this._lastCameraTransform);
    var justStop = false;
    if (this._lastCameraMovedStatus && !moving) {
      justStop = true;
    }
    this._lastCameraTransform.copy(this._camera.matrixWorld);
    this._lastCameraMovedStatus = moving;
    return { moving, justStop };
  }

  private _drawEveryFrame() {
    this._renderer.clear();
  }

  private *_drawProgressively() {
    let batchIndex = 0;
    if (this._renderBatches.length == 0) return;
    while (batchIndex < this._renderBatches.length) {
      const batch = this._renderBatches[batchIndex];
      batch.build();
      this._currentRenderBatch = batch;
      this._scene.add(batch);
      console.log(`Drawing ${batchIndex}/${this._renderBatches.length}`);
      yield;
      yield;
      this._scene.remove(batch);
      batch.dispose();
      batchIndex++;
    }
  }

  private _drawProgressivelyAbort() {
    console.log("draw progressively abort");
    if (this._currentRenderBatch) {
      this._scene.remove(this._currentRenderBatch);
      this._currentRenderBatch.dispose();
      this._currentRenderBatch = null;
    }
  }

  private _darwSingleFrame() {
    var { moving, justStop } = this._isCameraMovingOrJustStop();
    if (moving) {
      this._drawProgressivelyAbort();
      this._drawEveryFrame();
      this._drawCoroutine = null;
      return;
    }

    if (justStop) {
      this._drawProgressivelyAbort();
      this._drawEveryFrame();
      this._drawCoroutine = this._drawProgressively();
    }
    if (this._drawCoroutine == null) {
      return;
    }
    var frame = this._drawCoroutine.next();
    if (frame.done) this._drawCoroutine = null;
  }

  private _render() {
    this._stats.begin();
    this._darwSingleFrame();
    this._renderer.render(this._scene, this._camera);
    this._stats.end();
    requestAnimationFrame(this._render.bind(this));
  }
}

export { ModelRenderer };
