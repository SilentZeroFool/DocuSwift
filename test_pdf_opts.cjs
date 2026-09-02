const { PDFDocument, rgb, BlendMode } = require('pdf-lib');
const fs = require('fs');

(async () => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  
  const drawOpts = {
    borderColor: rgb(1, 0, 0),
    borderWidth: 10,
    borderOpacity: 0.5,
    blendMode: BlendMode.Multiply
  };
  
  page.drawSvgPath("M 100 -100 L 200 -200", drawOpts);
  const bytes = await pdfDoc.save();
  console.log("Success, bytes:", bytes.length);
})();
