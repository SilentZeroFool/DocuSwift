const fs = require('fs');
const pdf = fs.readFileSync('test_svg.pdf', 'utf-8');
console.log(pdf);
