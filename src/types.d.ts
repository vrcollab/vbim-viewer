import { Loader } from "./Loader";

declare global {
  interface Window {
    loader: Loader;
  }

  interface MeshInstance {
    boundingBox: { center: Array<number>; extents: Array<number> };
    id: string;
    materialId: string;
    meshId: Array<string>;
    transform: Array<number>;
    triangleCount: number;
  }

  interface Material {
    id: string;
    albedoColor: Array<number>;
    albedoColorMapId: Array<string>;
    name: string;
    rawDataJson: object | null;
    type: string;
  }

  interface Mesh {
    vertices: Array<number>;
    normals: Array<number> | null;
    indices: Array<number>;
  }
}
