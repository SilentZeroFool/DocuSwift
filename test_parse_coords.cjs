const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

(async () => {
    const bytes = fs.readFileSync('test_svg_coords.pdf');
    const pdfDoc = await PDFDocument.load(bytes);
    
    // get raw instructions
    const contents = Buffer.from(pdfDoc.getPage(0).node.Contents().lookup().contents).toString();
    console.log(contents);
})();
