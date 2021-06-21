export const workerEnvironment = !!self.document;
export function toUint8ClampedArray(arr) {
    return new Uint8ClampedArray(arr.buffer, arr.byteOffset, arr.byteLength);
}
export function toDataView(arr) {
    return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
export function toUint32Array(arr) {
    return new Uint32Array(arr.buffer, arr.byteOffset, arr.byteLength >> 2);
}
export function toHtmlCanvas(canvas) {
    if (canvas instanceof HTMLCanvasElement) {
        return canvas;
    }
    else {
        const result = document.createElement("canvas");
        result.width = canvas.width;
        result.height = canvas.height;
        result.getContext("2d").drawImage(canvas, 0, 0);
        return result;
    }
}
export function replaceUndefined(val, replacement) {
    return typeof val === "undefined" ? replacement : val;
}
export function isNullish(val) {
    return typeof val === "undefined" || val === null;
}
export function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}
export class AsyncStream {
    constructor() {
        this.listeners = new Set();
    }
    add(obj) {
        const actual = Array.from(this.listeners);
        for (let fun of actual) {
            queueMicrotask(() => fun(obj));
        }
    }
    listen(listener) {
        const listeners = this.listeners;
        listeners.add(listener);
        return {
            cancel() {
                listeners.delete(listener);
            }
        };
    }
}
export class Optional {
    constructor(value, absent = false) {
        this.valueOrNull = absent ? null : value;
        this.absent = absent;
    }
    get value() {
        if (this.absent)
            throw new TypeError("Optional value is absent");
        return this.valueOrNull;
    }
}
