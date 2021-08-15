import { randomScramble } from "./constants.js";

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

export function replaceNullish(val: any, replacement: any): any {
  return isNullish(val) ? replacement : val;
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

export interface CssColorWithLuminosity {
  readonly cssColor: string;
  readonly luminosity: number;

  setupAsBackgroundColor(element: HTMLElement): void;
}

function _reverse(i: number): number {
  let j = 0;
  let neg = i < 0;
  if (neg) i = -i;
  while (i > 0) {
    j <<= 1;
    j |= i & 1;
    i >>= 1;
  }
  return neg ? -j : j;
}

const _lum = [54, 183, 18];
const _colorMask = [88, 73, 0];
const _mask = [193, 150, 164, 236, 216, 33, 40, 11];
const _scramble = randomScramble
  ? (() => {
      const arr = Array(16)
        .fill(0)
        .map(_ => (Math.random() * 65536) | 0);
      console.log(arr.map(x => x.toString(16).padStart(4, "0")).join(""));
      return arr;
    })()
  : (hex => {
      const l = hex.length;
      const a: number[] = [];
      for (let i = 0; i < l; i += 4) {
        a.push(parseInt(hex.substring(i, i + 4), 16));
      }
      return a;
    })("5860089eab335b8ce5bb25d58822bf63ea84f4693e1054389bfca1615fdb114a");
// Varied: "8bbb5cc52989854c4c45a9eb1162d81d65f88b75d8b16cdf8a5b133a991c421d"
// Pink: "c0952d574c351e30668dd7f19a445d7fcf53bcd1b8c82130181c5b6162d706cc"
// Another varied: "c4d9ddc552245a0246cd4cb90c5e5f239710ae448d0e3c6ea889bcad1f3fa3ea"
// Less weird: "5860089eab335b8ce5bb25d58822bf63ea84f4693e1054389bfca1615fdb114a"
// Old: "fa31c5e826bd9407568192f7dcae04b3abd2ec850f439716ab62103895f74dce"

export function colorHashString(
  s: string,
  pastellizationFactor: number = 0
): CssColorWithLuminosity {
  if (s.length < 3) {
    s = Array.from(s)
      .map(s => _reverse(s.codePointAt(0)!).toString(2).padStart(8))
      .join("");
  }
  const codes = Array.from(s).map(s => s.codePointAt(0)!);
  const l = codes.length;
  let color: number[] = [];
  let luminosity = 0;
  const cm = _colorMask.values();
  let r = 0;
  let a = 0;
  let si = -1;
  for (let c of codes) {
    ++si;
    let scrambleBase = (si & 3) << 2;
    let scrambled = 0;
    for (let n = 0; n < 2; ++n) {
      let nibble = (c >> (n << 2)) & 0xf;
      scrambled <<= 4;
      scrambled |=
        _scramble[(scrambleBase + nibble) >> 2] >> ((nibble & 0x3) << 2);
    }
    a = (((a ^ _mask[si & 7]) * 17) ^ scrambled) & 0xff;
    r += 3;
    if (r >= l) {
      let ch = a;
      let cmCurrent = cm.next();
      if (!cmCurrent.done) ch ^= cmCurrent.value;
      color.push(ch);
      r -= l;
    }
  }
  if (pastellizationFactor) {
    let avg = color.reduce((a, b) => a + b) / color.length;
    avg = 255 * (1 - pastellizationFactor) + avg * pastellizationFactor;
    color = color.map(ch =>
      Math.max(
        0,
        Math.min(
          255,
          Math.round(
            ch * (1 - pastellizationFactor) + avg * pastellizationFactor
          )
        )
      )
    );
  }
  luminosity = color.map((ch, i) => _lum[i] * ch).reduce((a, b) => a + b) >>> 8;
  return new CssColorWithLuminosityImpl(
    "#" + color.map(e => e.toString(16).padStart(2, "0")).join(""),
    luminosity
  );
}

class CssColorWithLuminosityImpl {
  constructor(cssColor: string, luminosity: number) {
    this.cssColor = cssColor;
    this.luminosity = luminosity;
  }

  setupAsBackgroundColor(element: HTMLElement): void {
    element.style.backgroundColor = this.cssColor;
    element.style.color = this.luminosity >= 128 ? "black" : "white";
  }

  readonly cssColor: string;
  readonly luminosity: number;
}

export function createButton(
  caption: string,
  clickHandler: { (event: MouseEvent): void },
  { classes }: { classes?: string[] | string } = {}
) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = caption;
  button.addEventListener("click", e => clickHandler.call(this, e));
  if (classes instanceof Array) {
    button.classList.add(...classes);
  } else if (typeof classes === "string") {
    button.classList.add(classes);
  }
  return button;
}

export function loadBlob(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = _ => {
      resolve(fr.result as ArrayBuffer);
    };
    fr.onerror = e => {
      reject(e);
    };
    fr.readAsArrayBuffer(blob);
  });
}

export function overlapsView(e: HTMLElement): boolean {
  const r = e.getBoundingClientRect();
  if (r.bottom < 0) return false;
  if (r.right < 0) return false;
  if (r.top > window.innerHeight) return false;
  if (r.left > window.innerWidth) return false;
  return true;
}
