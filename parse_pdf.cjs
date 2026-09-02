const fs = require('fs');
const zlib = require('zlib');
const data = fs.readFileSync('out3.pdf');
const start = data.indexOf(Buffer.from('stream\n')) + 7;
const end = data.indexOf(Buffer.from('\nendstream'));
const stream = data.slice(start, end);
const inflated = zlib.inflateSync(stream);
console.log(inflated.toString());
