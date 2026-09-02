const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');

(async () => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  
  const pathData = "M 100 -100 L 200 -200 L 300 -100";
  
  page.drawSvgPath(pathData, {
    borderColor: rgb(1, 0, 0),
    borderWidth: 10,
    color: undefined,
  });
  
  const bytes = await pdfDoc.save({ useObjectStreams: false });
  fs.writeFileSync('out2.pdf', bytes);
})();
