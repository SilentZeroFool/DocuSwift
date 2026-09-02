const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
(async () => {
  const bytes = fs.readFileSync('test_svg.pdf');
  const pdfDoc = await PDFDocument.load(bytes);
  
  // Wait, saving with useObjectStreams: false is different.
  console.log(pdfDoc.getPage(0).node.Resources());
})();
