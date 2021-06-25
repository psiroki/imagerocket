export const workerEnvironment = !!self.document;

export function toUint8ClampedArray(
  arr:
    | DataView
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array
) {
  return new Uint8ClampedArray(arr.buffer, arr.byteOffset, arr.byteLength);
}

export function toDataView(
  arr:
    | DataView
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array
) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}

export function toUint32Array(
  arr:
    | DataView
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array
) {
  return new Uint32Array(arr.buffer, arr.byteOffset, arr.byteLength >> 2);
}

export function toHtmlCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas
): HTMLCanvasElement {
  if (canvas instanceof HTMLCanvasElement) {
    return canvas;
  } else {
    const result = document.createElement("canvas");
    result.width = canvas.width;
    result.height = canvas.height;
    result.getContext("2d")!.drawImage(canvas, 0, 0);
    return result;
  }
}

export function replaceUndefined(val: any, replacement: any): any {
  return typeof val === "undefined" ? replacement : val;
}

export function isNullish(val: any): boolean {
  return typeof val === "undefined" || val === null;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export interface Listener<T> {
  (obj: T): void;
}

export interface Subscription {
  cancel(): void;
}

export class AsyncStream<T> {
  add(obj: T): void {
    const actual = Array.from(this.listeners);
    for (let fun of actual) {
      queueMicrotask(() => fun(obj));
    }
  }

  listen(listener: Listener<T>): Subscription {
    const listeners = this.listeners;
    listeners.add(listener);
    return {
      cancel() {
        listeners.delete(listener);
      },
    };
  }

  private listeners: Set<Listener<T>> = new Set();
}

export class Optional<T> {
  constructor(value: T, absent: boolean = false) {
    this.valueOrNull = absent ? null : value;
    this.absent = absent;
  }

  get value(): T {
    if (this.absent) throw new TypeError("Optional value is absent");
    return this.valueOrNull!;
  }

  private readonly valueOrNull: T | null;
  readonly absent: boolean;
}

export function deepCopyJson(val: any): any {
  if (val instanceof Array) {
    return val.map(deepCopyJson);
  } else if (val && typeof val === "object") {
    return Object.fromEntries(
      Object.entries(val).map(entry => [entry[0], deepCopyJson(entry[1])])
    );
  } else {
    // scalar
    return val;
  }
}
