import * as util from "./util.js";

export interface CanvasFactory {
  (): HTMLCanvasElement | OffscreenCanvas;
}

export const defaultCanvasFactory: CanvasFactory =
  () => document.createElement("canvas");

export class CropParmeters {
  initCropRect(buffer: ImageBuffer) {
    this._cropRect = [0, 0, buffer.width, buffer.height];
  }

  get cropRect(): number[] {
    return this._cropRect!;
  }

  set cropRect(r: number[]) {
    this._cropRect = r;
    this._expandedRect = null;
  }

  get expandedRect(): number[] {
    return this._expandedRect || this._cropRect!;
  }

  set expandedRect(r: number[]) {
    this._expandedRect = r;
  }


  private _cropRect: number[] | null = null;
  private _expandedRect: number[] | null = null;
}

export abstract class ImageBuffer {
  abstract get bytes(): DataView;
  abstract get width(): number;
  abstract get height(): number;
  get wordPitch() {
    return this.pitch >> 2;
  }
  abstract get pitch(): number;
  abstract toByteImageBuffer(): ByteImageBuffer;
  toCanvasImageBuffer(canvasFactory: CanvasFactory = defaultCanvasFactory): CanvasImageBuffer {
    return this._toCanvasImageBuffer(canvasFactory);
  }
  protected abstract _toCanvasImageBuffer(canvasFactory: CanvasFactory): CanvasImageBuffer;
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

  _toCanvasImageBuffer(canvasFactory: CanvasFactory): CanvasImageBuffer {
    const canvas = canvasFactory();
    canvas.width = this._width;
    canvas.height = this._height;
    const bytes = this._bytes;
    canvas.getContext("2d")!.putImageData(
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
  constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
    super();
    this._canvas = canvas;
    this._context = canvas.getContext("2d")!;
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

  _toCanvasImageBuffer(canvasFactory: CanvasFactory): CanvasImageBuffer {
    return this;
  }

  get canvas(): HTMLCanvasElement | OffscreenCanvas {
    return this._canvas;
  }

  private _canvas: HTMLCanvasElement | OffscreenCanvas;
  private _context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  private _data: ImageData;
  private _bytes: DataView;
}

