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
export function replaceNullish(val, replacement) {
    return isNullish(val) ? replacement : val;
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
            },
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
export function deepCopyJson(val) {
    if (val instanceof Array) {
        return val.map(deepCopyJson);
    }
    else if (val && typeof val === "object") {
        return Object.fromEntries(Object.entries(val).map(entry => [entry[0], deepCopyJson(entry[1])]));
    }
    else {
        // scalar
        return val;
    }
}
function _reverse(i) {
    let j = 0;
    let neg = i < 0;
    if (neg)
        i = -i;
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
const _scramble = [
    64049, 50664, 9917, 37895, 22145, 37623, 56494, 1203, 43986, 60549, 3907,
    38678, 43874, 4152, 38391, 19918,
];
export function colorHashString(s, pastellizationFactor = 0) {
    if (s.length < 3) {
        s = Array.from(s)
            .map(s => _reverse(s.codePointAt(0)).toString(2).padStart(8))
            .join("");
    }
    const codes = Array.from(s).map(s => s.codePointAt(0));
    const l = codes.length;
    let color = [];
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
            if (!cmCurrent.done)
                ch ^= cmCurrent.value;
            color.push(ch);
            r -= l;
        }
    }
    if (pastellizationFactor) {
        let avg = color.reduce((a, b) => a + b) / color.length;
        avg = 255 * (1 - pastellizationFactor) + avg * pastellizationFactor;
        color = color.map(ch => Math.max(0, Math.min(255, Math.round(ch * (1 - pastellizationFactor) + avg * pastellizationFactor))));
    }
    luminosity = color.map((ch, i) => _lum[i] * ch).reduce((a, b) => a + b) >>> 8;
    return new CssColorWithLuminosityImpl("#" + color.map(e => e.toString(16).padStart(2, "0")).join(""), luminosity);
}
class CssColorWithLuminosityImpl {
    constructor(cssColor, luminosity) {
        this.cssColor = cssColor;
        this.luminosity = luminosity;
    }
    setupAsBackgroundColor(element) {
        element.style.backgroundColor = this.cssColor;
        element.style.color = this.luminosity >= 128 ? "black" : "white";
    }
}
export function createButton(caption, clickHandler, { classes } = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = caption;
    button.addEventListener("click", e => clickHandler.call(this, e));
    if (classes instanceof Array) {
        button.classList.add(...classes);
    }
    else if (typeof classes === "string") {
        button.classList.add(classes);
    }
    return button;
}
export function loadBlob(blob) {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = _ => {
            resolve(fr.result);
        };
        fr.onerror = e => {
            reject(e);
        };
        fr.readAsArrayBuffer(blob);
    });
}
export function overlapsView(e) {
    const r = e.getBoundingClientRect();
    if (r.bottom < 0)
        return false;
    if (r.right < 0)
        return false;
    if (r.top > window.innerHeight)
        return false;
    if (r.left > window.innerWidth)
        return false;
    return true;
}
