export function toUint8ClampedArray(arr: DataView |
  Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array) {
  return new Uint8ClampedArray(arr.buffer, arr.byteOffset, arr.byteLength);
}

export function toDataView(arr: DataView |
  Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}

export function toUint32Array(arr: DataView |
  Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array) {
  return new Uint32Array(arr.buffer, arr.byteOffset, arr.byteLength >> 2);
}
