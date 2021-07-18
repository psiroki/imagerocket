import * as util from "../common/util.js";

/**
 * A 32 bit color value with alpha. Always in playform endianness
 * and pixel order.
 */
export type Color = number;
export const colorMask = (() => {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 4;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f00f";
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillStyle = "#0f0f";
  ctx.fillRect(1, 0, 1, 1);
  ctx.fillStyle = "#00ff";
  ctx.fillRect(2, 0, 1, 1);
  ctx.fillStyle = "#000f";
  ctx.fillRect(3, 0, 1, 1);
  const components = new Uint32Array(ctx.getImageData(0, 0, 4, 1).data.buffer);
  const alphaMask = components[3];
  for (let i = 0; i < 3; ++i) components[i] -= alphaMask;
  return {
    components,
    red: components[0],
    green: components[1],
    blue: components[2],
    alpha: components[3],
  };
})();

// not going to export these, because they're tricky to handle:
// maskToShift[0xff000000] will not work, because 0xff000000 is
// interpreted as a double, but maskToShift[0xff000000|0] will
// work
const maskToShift = {
  [0xff]: (val: number) => val,
  [0xff << 8]: (val: number) => val << 8,
  [0xff << 16]: (val: number) => val << 16,
  [0xff << 24]: (val: number) => val << 24,
};

const maskToExtract = {
  [0xff]: (val: number) => val & 0xff,
  [0xff << 8]: (val: number) => (val >>> 8) & 0xff,
  [0xff << 16]: (val: number) => (val >>> 16) & 0xff,
  [0xff << 24]: (val: number) => (val >>> 24) & 0xff,
};

// Hopefully the JIT will inline these functions, I've tried to link
// them as statically as possible.
// TODO: make them work in a Worker environment, communicate with the
// main page (they're going to be initialized asynchronously with root
// level awaits)
export const shiftToRed = (() => {
  // Rgba or abgR
  return maskToShift[colorMask.red | 0];
})();
export const shiftToGreen = (() => {
  // rGba or abGr
  return maskToShift[colorMask.green | 0];
})();
export const shiftToBlue = (() => {
  // rgBa or aBgr
  return maskToShift[colorMask.blue | 0];
})();
export const shiftToAlpha = (() => {
  // rgbA or Abgr
  return maskToShift[colorMask.alpha | 0];
})();

export const extractRed = (() => {
  // Rgba or abgR
  return maskToExtract[colorMask.red | 0];
})();
export const extractGreen = (() => {
  // rGba or abGr
  return maskToExtract[colorMask.green | 0];
})();
export const extractBlue = (() => {
  // rgBa or aBgr
  return maskToExtract[colorMask.blue | 0];
})();
export const extractAlpha = (() => {
  // rgbA or Abgr
  return maskToExtract[colorMask.alpha | 0];
})();

export function rgba(r: number, g: number, b: number, a: number): number {
  return shiftToRed(r) | shiftToGreen(g) | shiftToBlue(b) | shiftToAlpha(a);
}

export const platformIsLittleEndian = (() => {
  const test = new Uint32Array([0x12345678]);
  return new DataView(test.buffer).getUint32(0, true) === 0x12345678;
})();

export function formatColor(c: Color): string {
  return (
    "#" +
    [extractRed(c), extractGreen(c), extractBlue(c), extractAlpha(c)]
      .map(n => n.toString(16).padStart(2, "0"))
      .join("")
  );
}

export interface CanvasFactory {
  (): HTMLCanvasElement | OffscreenCanvas;
}

export const canvasCapableEnvironment = !!(
  self.document || self.OffscreenCanvas
);

export const offscreenCanvasFactory: CanvasFactory = self.OffscreenCanvas
  ? () => new OffscreenCanvas(300, 150)
  : () => {
      throw new Error("Environment has no canvas capability");
    };

export const defaultCanvasFactory: CanvasFactory = self.document
  ? () => document.createElement("canvas")
  : offscreenCanvasFactory;

export class CropParameters {
  constructor(copyFrom?: CropParameters) {
    if (copyFrom) {
      this._cropRect = copyFrom._cropRect
        ? Array.from(copyFrom._cropRect)
        : null;
      this._expandedRect = copyFrom._expandedRect
        ? Array.from(copyFrom._expandedRect)
        : null;
      this.color = copyFrom.color;
    }
  }

  initCropRect(buffer: ImageBuffer): CropParameters {
    this._cropRect = [0, 0, buffer.width, buffer.height];
    this._expandedRect = null;
    return this;
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

  toString(): string {
    return [formatColor(this.color), this._cropRect, this.expandedRect].join(
      "; "
    );
  }

  color: Color = colorMask.alpha; // opaque black

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

  drawOnCanvas(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    resizeCanvas: boolean = true
  ): void {
    this._drawOnCanvas(canvas, resizeCanvas);
  }

  protected abstract _drawOnCanvas(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    resizeCanvas: boolean
  ): void;

  abstract toByteImageBuffer(): ByteImageBuffer;
  toCanvasImageBuffer(
    canvasFactory: CanvasFactory = defaultCanvasFactory
  ): CanvasImageBuffer {
    return this._toCanvasImageBuffer(canvasFactory);
  }
  protected abstract _toCanvasImageBuffer(
    canvasFactory: CanvasFactory
  ): CanvasImageBuffer;

  get cropParameters(): CropParameters {
    if (!this._cropParameters) {
      this._cropParameters = new CropParameters().initCropRect(this);
    }
    return this._cropParameters!;
  }

  set cropParameters(newParams: CropParameters) {
    this._cropParameters = new CropParameters(newParams);
  }

  protected _cropParameters?: CropParameters;
}

export class ByteImageBuffer extends ImageBuffer {
  static allocate(width: number, height: number): ByteImageBuffer {
    const bytes = new DataView(new ArrayBuffer((width * height) << 2));
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

  protected _drawOnCanvas(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    resizeCanvas: boolean
  ): void {
    if (resizeCanvas) {
      canvas.width = this._width;
      canvas.height = this._height;
    }
    const bytes = this._bytes;
    canvas
      .getContext("2d")!
      .putImageData(
        new ImageData(
          util.toUint8ClampedArray(bytes),
          this._pitch >> 2,
          this._height
        ),
        0,
        0
      );
  }

  toByteImageBuffer(): ByteImageBuffer {
    return this;
  }

  _toCanvasImageBuffer(canvasFactory: CanvasFactory): CanvasImageBuffer {
    const canvas = canvasFactory();
    this._drawOnCanvas(canvas, true);
    const buffer = new CanvasImageBuffer(canvas);
    buffer.cropParameters = this.cropParameters;
    return buffer;
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

  protected _drawOnCanvas(
    newCanvas: HTMLCanvasElement | OffscreenCanvas,
    resizeCanvas: boolean
  ): void {
    if (resizeCanvas) {
      newCanvas.width = this._canvas.width;
      newCanvas.height = this._canvas.height;
    }
    newCanvas.getContext("2d")!.drawImage(this._canvas, 0, 0);
  }

  toByteImageBuffer(): ByteImageBuffer {
    const buffer = new ByteImageBuffer(
      this.bytes,
      this.width,
      this.height,
      this.pitch
    );
    buffer.cropParameters = this.cropParameters;
    return buffer;
  }

  _toCanvasImageBuffer(canvasFactory: CanvasFactory): CanvasImageBuffer {
    const newCanvas = canvasFactory();
    if (
      newCanvas instanceof HTMLCanvasElement ===
      this._canvas instanceof HTMLCanvasElement
    ) {
      return this;
    } else {
      this._drawOnCanvas(newCanvas, true);
      const buffer = new CanvasImageBuffer(newCanvas);
      buffer.cropParameters = this.cropParameters;
      return buffer;
    }
  }

  get canvas(): HTMLCanvasElement | OffscreenCanvas {
    return this._canvas;
  }

  private _canvas: HTMLCanvasElement | OffscreenCanvas;
  private _context:
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D;
  private _data: ImageData;
  private _bytes: DataView;
}
