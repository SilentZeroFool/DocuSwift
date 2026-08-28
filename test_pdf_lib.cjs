const { PDFDocument, rgb } = require('pdf-lib');
(async () => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  try {
    page.drawSvgPath('M 10 10 L 20 20', {
      borderColor: rgb(1, 0, 0),
      borderWidth: 5,
      borderOpacity: 0.5,
      color: undefined,
    });
    console.log("Success with undefined color");
  } catch (e) {
    console.error("Failed:", e);
  }
})();
