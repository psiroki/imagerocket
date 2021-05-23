import * as util from "./util.js";

export abstract class ImageBuffer {
  abstract get bytes(): DataView;
  abstract get width(): number;
  abstract get height(): number;
  get wordPitch() {
    return this.pitch >> 2;
  }
  abstract get pitch(): number;
  abstract toByteImageBuffer(): ByteImageBuffer;
  abstract toCanvasImageBuffer(): CanvasImageBuffer;
}

export class ByteImageBuffer extends ImageBuffer {
  static allocate(width: number, height: number): ByteImageBuffer {
    const bytes = new DataView(new ArrayBuffer(width*height << 2));
    return new ByteImageBuffer(bytes, width, height, width << 2);
  }

  constructor(bytes: DataView, width: number, height: number, pitch: number) {
    super();
    this._bytes = bytes;
    this._width = width;
    this._height = height;
    this._pitch = pitch;
  }

  get bytes(): DataView {
    return this._bytes;
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  get pitch(): number {
    return this._pitch;
  }

  toByteImageBuffer(): ByteImageBuffer {
    return this;
  }

  toCanvasImageBuffer(): CanvasImageBuffer {
    const canvas = document.createElement("canvas");
    canvas.width = this._width;
    canvas.height = this._height;
    const bytes = this._bytes;
    canvas.getContext("2d").putImageData(
      new ImageData(util.toUint8ClampedArray(bytes), this._pitch >> 2, this._height),
      0, 0);
    return new CanvasImageBuffer(canvas);
  }

  private _bytes: DataView;
  private _width: number;
  private _height: number;
  private _pitch: number;
}

export class CanvasImageBuffer extends ImageBuffer {
  constructor(canvas: HTMLCanvasElement) {
    super();
    this._canvas = canvas;
    this._context = canvas.getContext("2d");
  }

  get bytes(): DataView {
    if (!this._bytes) {
      this._data = this._context.getImageData(0, 0, this.width, this.height);
      this._bytes = util.toDataView(this._data.data);
    }
    return this._bytes;
  }

  get width(): number {
    return this._canvas.width;
  }

  get height(): number {
    return this._canvas.height;
  }

  get pitch(): number {
    return this.width * 4;
  }

  toByteImageBuffer(): ByteImageBuffer {
    return new ByteImageBuffer(this.bytes, this.width, this.height, this.pitch);
  }

  toCanvasImageBuffer(): CanvasImageBuffer {
    return this;
  }

  get canvas(): HTMLCanvasElement {
    return this._canvas;
  }

  private _canvas: HTMLCanvasElement;
  private _context: CanvasRenderingContext2D;
  private _data: ImageData;
  private _bytes: DataView;
}

