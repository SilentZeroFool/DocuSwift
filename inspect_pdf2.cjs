const { PDFDocument, rgb, LineCapStyle } = require('pdf-lib');
(async () => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  
  page.drawSvgPath("M 100 100 L 200 200", {
    borderColor: rgb(1, 0, 0),
    borderWidth: 12,
    color: undefined,
  });
  
  const savedBytes = await pdfDoc.save();
  const content = Buffer.from(savedBytes).toString('utf-8');
  console.log(content);
})();
