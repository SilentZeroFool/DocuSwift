const arr = new Uint8Array([1, 2, 3, 4, 5]);
const sub = arr.subarray(1, 4); // [2, 3, 4]
const copy = new Uint8Array(sub);
console.log(copy.buffer.byteLength); // Should be 3
console.log(new Uint8Array(copy.buffer)); // Should be [2, 3, 4]
