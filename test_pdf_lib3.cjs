const { PDFDocument, rgb } = require('pdf-lib');
(async () => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  try {
    page.drawSvgPath('M 10 10 L 20 20', {
      borderColor: rgb(1, 0, 0),
      borderWidth: 5,
      opacity: 0.5,
    });
    console.log("Success with opacity");
  } catch (e) {
    console.error("Failed:", e);
  }
})();
