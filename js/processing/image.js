import * as util from "./util.js";
export const colorMask = (() => {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 4;
    const ctx = canvas.getContext("2d");
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
    for (let i = 0; i < 3; ++i)
        components[i] -= alphaMask;
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
    [0xff]: (val) => val,
    [0xff << 8]: (val) => val << 8,
    [0xff << 16]: (val) => val << 16,
    [0xff << 24]: (val) => val << 24,
};
const maskToExtract = {
    [0xff]: (val) => val & 0xff,
    [0xff << 8]: (val) => (val >>> 8) & 0xff,
    [0xff << 16]: (val) => (val >>> 16) & 0xff,
    [0xff << 24]: (val) => (val >>> 24) & 0xff,
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
export function rgba(r, g, b, a) {
    return shiftToRed(r) | shiftToGreen(g) | shiftToBlue(b) | shiftToAlpha(a);
}
export const platformIsLittleEndian = (() => {
    const test = new Uint32Array([0x12345678]);
    return new DataView(test.buffer).getUint32(0, true) === 0x12345678;
})();
export function formatColor(c) {
    return ("#" +
        [extractRed(c), extractGreen(c), extractBlue(c), extractAlpha(c)]
            .map(n => n.toString(16).padStart(2, "0"))
            .join(""));
}
export const canvasCapableEnvironment = !!(self.document || self.OffscreenCanvas);
export const offscreenCanvasFactory = self.OffscreenCanvas
    ? () => new OffscreenCanvas(300, 150)
    : () => {
        throw new Error("Environment has no canvas capability");
    };
export const defaultCanvasFactory = self.document
    ? () => document.createElement("canvas")
    : offscreenCanvasFactory;
export class CropParameters {
    constructor(copyFrom) {
        this.color = colorMask.alpha; // opaque black
        this._cropRect = null;
        this._expandedRect = null;
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
    initCropRect(buffer) {
        this._cropRect = [0, 0, buffer.width, buffer.height];
        this._expandedRect = null;
        return this;
    }
    get cropRect() {
        return this._cropRect;
    }
    set cropRect(r) {
        this._cropRect = r;
        this._expandedRect = null;
    }
    get expandedRect() {
        return this._expandedRect || this._cropRect;
    }
    set expandedRect(r) {
        this._expandedRect = r;
    }
    toString() {
        return [formatColor(this.color), this._cropRect, this.expandedRect].join("; ");
    }
}
export class ImageBuffer {
    get wordPitch() {
        return this.pitch >> 2;
    }
    toCanvasImageBuffer(canvasFactory = defaultCanvasFactory) {
        return this._toCanvasImageBuffer(canvasFactory);
    }
    get cropParameters() {
        if (!this._cropParameters) {
            this._cropParameters = new CropParameters().initCropRect(this);
        }
        return this._cropParameters;
    }
    set cropParameters(newParams) {
        this._cropParameters = new CropParameters(newParams);
    }
}
export class ByteImageBuffer extends ImageBuffer {
    constructor(bytes, width, height, pitch) {
        super();
        this._bytes = bytes;
        this._width = width;
        this._height = height;
        this._pitch = pitch;
    }
    static allocate(width, height) {
        const bytes = new DataView(new ArrayBuffer((width * height) << 2));
        return new ByteImageBuffer(bytes, width, height, width << 2);
    }
    get bytes() {
        return this._bytes;
    }
    get width() {
        return this._width;
    }
    get height() {
        return this._height;
    }
    get pitch() {
        return this._pitch;
    }
    toByteImageBuffer() {
        return this;
    }
    _toCanvasImageBuffer(canvasFactory) {
        const canvas = canvasFactory();
        canvas.width = this._width;
        canvas.height = this._height;
        const bytes = this._bytes;
        canvas
            .getContext("2d")
            .putImageData(new ImageData(util.toUint8ClampedArray(bytes), this._pitch >> 2, this._height), 0, 0);
        const buffer = new CanvasImageBuffer(canvas);
        buffer.cropParameters = this.cropParameters;
        return buffer;
    }
}
export class CanvasImageBuffer extends ImageBuffer {
    constructor(canvas) {
        super();
        this._canvas = canvas;
        this._context = canvas.getContext("2d");
    }
    get bytes() {
        if (!this._bytes) {
            this._data = this._context.getImageData(0, 0, this.width, this.height);
            this._bytes = util.toDataView(this._data.data);
        }
        return this._bytes;
    }
    get width() {
        return this._canvas.width;
    }
    get height() {
        return this._canvas.height;
    }
    get pitch() {
        return this.width * 4;
    }
    toByteImageBuffer() {
        const buffer = new ByteImageBuffer(this.bytes, this.width, this.height, this.pitch);
        buffer.cropParameters = this.cropParameters;
        return buffer;
    }
    _toCanvasImageBuffer(canvasFactory) {
        const newCanvas = canvasFactory();
        if (newCanvas instanceof HTMLCanvasElement ===
            this._canvas instanceof HTMLCanvasElement) {
            return this;
        }
        else {
            newCanvas.width = this._canvas.width;
            newCanvas.height = this._canvas.height;
            newCanvas.getContext("2d").drawImage(this._canvas, 0, 0);
            const buffer = new CanvasImageBuffer(newCanvas);
            buffer.cropParameters = this.cropParameters;
            return buffer;
        }
    }
    get canvas() {
        return this._canvas;
    }
}
