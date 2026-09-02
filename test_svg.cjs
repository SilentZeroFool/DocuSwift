const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');

(async () => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([500, 500]);
  
  // Let's draw a path from (0,0) to (100,100)
  // If (0,0) is bottom-left, it will draw from bottom-left to top-right.
  // BUT wait! Does drawSvgPath invert Y automatically?
  page.drawSvgPath("M 0 0 L 100 100", { borderColor: rgb(1,0,0), borderWidth: 2 });
  
  const bytes = await pdfDoc.save();
  fs.writeFileSync('test_svg.pdf', bytes);
})();
