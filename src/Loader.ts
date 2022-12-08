import axios from "axios";
import { Buffer } from "buffer";
import { BufferReader } from "./BufferReader";
import { RenderBatch } from "./RenderBatch";

class Loader {
  private readonly _baseUrl: string =
    "https://s3.ap-southeast-1.amazonaws.com/staging-assets-vbim.vrcollab.com";
  public meshInstanses: Array<MeshInstance>;
  public materials: { [key: string]: Material };
  public meshCollections: { [key: string]: Mesh };

  constructor() {
    this.meshInstanses = [];
    this.materials = {};
    this.meshCollections = {};
  }

  public async load(vbimFileId: string) {
    console.time("loader gets");

    console.time("loader gets mesh instances");
    var resp = await axios.get(
      `${this._baseUrl}/${vbimFileId}/sortedMeshInstances.json.gz`
    );
    this.meshInstanses = resp.data as Array<MeshInstance>;
    console.timeEnd("loader gets mesh instances");

    console.time("loader gets materials");
    resp = await axios.get(`${this._baseUrl}/${vbimFileId}/materials.json.gz`);
    var materials = resp.data as Array<Material>;
    for (let i = 0; i < materials.length; i++) {
      this.materials[materials[i].id] = materials[i];
    }
    console.timeEnd("loader gets materials");

    console.time("loader gets mesh collection");
    var meshCollectionIds = [
      ...new Set(this.meshInstanses.map((m) => m.meshId[0])),
    ];
    var meshCollections = (
      await Promise.all(
        meshCollectionIds.map((id) =>
          axios.get(`${this._baseUrl}/${vbimFileId}/${id}.bin.gz`, {
            responseType: "arraybuffer",
          })
        )
      )
    ).map((resp) => resp.data);
    for (let i = 0; i < meshCollections.length; i++) {
      this._parseMeshCollection(meshCollections[i]);
    }
    console.timeEnd("loader gets mesh collection");

    console.timeEnd("loader gets");
  }

  public getRenderBatches(): Array<RenderBatch> {
    const renderBatches: Array<RenderBatch> = [];
    var renderBatch = new RenderBatch(this);
    for (let i = 0; i < this.meshInstanses.length; i++) {
      if (!renderBatch.tryAdd(this.meshInstanses[i])) {
        renderBatches.push(renderBatch);
        renderBatch = new RenderBatch(this);
        renderBatch.tryAdd(this.meshInstanses[i]);
      }
    }
    renderBatches.push(renderBatch);
    return renderBatches;
  }

  private _parseMeshCollection(data: ArrayBuffer) {
    const buffer = new BufferReader(Buffer.from(data));
    buffer.readUtf8String();
    const meshCount = buffer.readInt32();
    for (let i = 0; i < meshCount; i++) {
      // bytes count
      buffer.readInt32();
      const id = buffer.readUtf8String();
      // meshTopology
      buffer.readInt32();
      const verticesCount = buffer.readInt32();
      const vertices: Array<number> = [];
      const normals: Array<number> = [];
      for (let v = 0; v < verticesCount; v++) {
        vertices.push(-buffer.readFloat32());
        vertices.push(buffer.readFloat32());
        vertices.push(buffer.readFloat32());
      }
      const indicesCount = buffer.readInt32();
      const indices: Array<number> = [];
      for (let v = 0; v < indicesCount / 3; v++) {
        const x1 = buffer.readInt32();
        const x2 = buffer.readInt32();
        const x3 = buffer.readInt32();
        indices.push(x1);
        indices.push(x2);
        indices.push(x3);
      }

      const hasNormal = buffer.readInt8();
      if (hasNormal) {
        const normalsCount = buffer.readInt32();
        for (let v = 0; v < normalsCount; v++) {
          normals.push(-buffer.readFloat32());
          normals.push(buffer.readFloat32());
          normals.push(buffer.readFloat32());
        }
      }

      const hasUV = buffer.readInt8();
      if (hasUV) {
        const uvCount = buffer.readInt32();
        for (let v = 0; v < uvCount; v++) {
          buffer.readFloat32();
          buffer.readFloat32();
        }
      }

      this.meshCollections[id] = { vertices, indices, normals };
    }
  }
}

export { Loader };
