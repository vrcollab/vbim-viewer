import * as THREE from "three";
import { Loader } from "./Loader";

class RenderBatch extends THREE.Object3D {
  private static _materials: { [key: string]: THREE.Material } = {};
  private readonly MaxObjectsCount = 1_000;
  private readonly MaxTrianglesCount = 1_000_000;
  private _loader: Loader;
  private _triangleCount = 0;
  private _meshInstances = new Array<MeshInstance>();

  constructor(loader: Loader) {
    super();
    this._loader = loader;
  }

  public tryAdd(meshInstance: MeshInstance): boolean {
    var triangleCount = meshInstance.triangleCount;
    triangleCount = triangleCount == 0 ? 1000 : triangleCount;
    if (
      this._meshInstances.length >= this.MaxObjectsCount ||
      this._triangleCount + triangleCount >= this.MaxTrianglesCount
    ) {
      return false;
    }

    this._meshInstances.push(meshInstance);
    this._triangleCount += triangleCount;
    return true;
  }

  public build() {
    for (let i = 0; i < this._meshInstances.length; i++) {
      const meshInstance = this._meshInstances[i];
      const data = this._loader.meshCollections[meshInstance.meshId[1]];
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(data.vertices), 3)
      );
      if (data.normals) {
        geometry.setAttribute(
          "normal",
          new THREE.BufferAttribute(new Float32Array(data.normals!), 3)
        );
      }
      geometry.setIndex(
        new THREE.BufferAttribute(new Uint32Array(data.indices), 1)
      );
      if (!RenderBatch._materials[meshInstance.materialId]) {
        const m = this._loader.materials[meshInstance.materialId];
        RenderBatch._materials[meshInstance.materialId] = this._createMaterial(
          m.albedoColor[3] > 0.7 ? "sketch" : "xray",
          new THREE.Color(...m.albedoColor)
        );
      }
      const material = RenderBatch._materials[meshInstance.materialId];
      const mesh = new THREE.Mesh(geometry, material);
      const matrix = new THREE.Matrix4();
      // .multiply(new Matrix4().makeScale(-1,1,1)).premultiply(new Matrix4().makeScale(-1,1,1))
      //  awkward way of flipping the x position!
      matrix
        .fromArray(meshInstance.transform)
        .multiply(new THREE.Matrix4().makeScale(-1, 1, 1))
        .premultiply(new THREE.Matrix4().makeScale(-1, 1, 1));
      var position = new THREE.Vector3();
      var rotation = new THREE.Quaternion();
      var scale = new THREE.Vector3();
      matrix.decompose(position, rotation, scale);
      mesh.position.copy(position);
      mesh.quaternion.copy(rotation);
      mesh.scale.copy(scale);
      this.add(mesh);
    }
  }

  public dispose(): void {
    for (let i = 0; i < this.children.length; i++) {
      var child = this.children[i];
      var mesh = child as THREE.InstancedMesh;
      mesh?.geometry?.dispose();
      this.remove(child);
    }
  }

  private _createMaterial(
    t: string,
    color: THREE.Color,
    planes?: THREE.Plane[]
  ): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        maincolor: { value: color },
      },
      vertexShader: `
          uniform float p;
          
          //varying float fresnel;
          
					varying vec3 vPositionW;
					varying vec3 vNormalW;

          #include <clipping_planes_pars_vertex>
          
          void main()
          {
            #include <begin_vertex>
              
            vec4 worldPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
            worldPosition = instanceMatrix * worldPosition;
#endif
            worldPosition = modelMatrix * worldPosition; // source of three js indicate instanced geometry also model mat multiplication, maybe not needed?  (https://github.com/mrdoob/three.js/tree/master/src/renderers/shaders/ShaderChunk)
            vPositionW = worldPosition.xyz;
#ifdef USE_INSTANCING              
            vNormalW = normalize( vec3( instanceMatrix * vec4( normal, 0.0 ) ) );       
#else         
            vNormalW = normalize( vec3( modelMatrix * vec4( normal, 0.0 ) ) );       
#endif            
            //vPositionW =          vec3( vec4( position, 1.0 ) * modelMatrix);
            //vNormalW = normalize( vec3( vec4( normal,   0.0 ) * modelMatrix) );

            //vec3 vNormal = normalize( normalMatrix * normal );
            //fresnel = abs(dot(vNormal, vec3(0, 0, 1)));

            #include <project_vertex>
            #include <clipping_planes_vertex>
          }
  `,
      fragmentShader:
        `
          
          uniform vec3 maincolor;
          
          //varying float fresnel;
          
					varying vec3 vPositionW;
					varying vec3 vNormalW;
          
          #include <clipping_planes_pars_fragment>
          
          void main()
          {
            #include <clipping_planes_fragment>

            vec3 x = maincolor;
            x = mix(x, vec3(1.0), 0.01); // make sure pure blacks still get some shading
            vec3 viewDirectionW = normalize(vPositionW - cameraPosition);
            float fresnel = abs(dot(viewDirectionW, normalize(vNormalW)));              
` +
        (t == "sketch"
          ? `
            fresnel = 4.0 * fresnel * mix(fresnel, 1.0, 0.5) * 0.8 + 0.05;`
          : /*else*/
            `
            float xray_depth = 100.;
            float distanceFromCamera = 1.;
            
            fresnel = 1.0 - fresnel; // flip shading for xray
            fresnel = 0.5 * fresnel * mix(fresnel, 1.0, 0.5) * 0.8 + 0.05;
            fresnel *= (1.0 - 0.98 * smoothstep(xray_depth * (2.0 / 14.0), xray_depth, distanceFromCamera)) * 0.7;`) +
        `
            fresnel *= 0.5;
            x *= fresnel; // apply fake lighting
  
            // postfx
            x = x / (x * 0.5 + 1.0);
            x = min(x, 1.875);
            vec3 x2 = x * x;
            x = x * (0.0161817 * x2 * x2 - 0.18963 * x2 + 1.0);
            
            gl_FragColor = vec4(x, 1.0);
          }`,
      side:
        t == "xray" || planes != undefined
          ? THREE.DoubleSide
          : THREE.DoubleSide,
      blending: t == "xray" ? THREE.AdditiveBlending : THREE.NoBlending,
      transparent: t == "xray",
      depthWrite: t == "sketch",
      clipping: planes != undefined,
      ...(planes != undefined && { clippingPlanes: planes }),
    });
  }
}

export { RenderBatch };
