import type { Buffer } from "buffer";

class BufferReader {
  private _buffer: Buffer;
  private _offset: number = 0;
  private _littleEndian: boolean = true;

  constructor(buffer: Buffer) {
    this._buffer = buffer;
  }

  get buffer(): Buffer {
    return this._buffer;
  }

  get offset(): number {
    return this._offset;
  }

  get littleEndian(): boolean {
    return this._littleEndian;
  }

  set littleEndian(littleEndian: boolean) {
    this._littleEndian = littleEndian;
  }

  readInt8(): number {
    const value = this._buffer.readInt8(this._offset);
    this._offset += 1;
    return value;
  }

  readUInt8(): number {
    const value = this._buffer.readUInt8(this._offset);
    this._offset += 1;
    return value;
  }

  readInt16(): number {
    const value = this._buffer.readInt16LE(this._offset);
    this._offset += 2;
    return value;
  }

  readUInt16(): number {
    const value = this._buffer.readUInt16LE(this._offset);
    this._offset += 2;
    return value;
  }

  readInt32(): number {
    const value = this._buffer.readInt32LE(this._offset);
    this._offset += 4;
    return value;
  }

  readUInt32(): number {
    const value = this._buffer.readUInt32LE(this._offset);
    this._offset += 4;
    return value;
  }

  readFloat32(): number {
    const value = this._buffer.readFloatLE(this._offset);
    this._offset += 4;
    return value;
  }

  readFloat64(): number {
    const value = this._buffer.readDoubleLE(this._offset);
    this._offset += 8;
    return value;
  }

  readUtf8String(): string {
    const length = this.readInt32();
    const value = this._buffer.toString(
      "utf8",
      this._offset,
      this._offset + length
    );
    this._offset += length;
    return value;
  }

  readBuffer(length: number): Buffer {
    const value = this._buffer.slice(this._offset, this._offset + length);
    this._offset += length;
    return value;
  }
}

export { BufferReader };
