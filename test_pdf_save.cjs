const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');

(async () => {
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    
    const drawOpts = {
      borderColor: rgb(1, 0, 0),
      borderWidth: 5,
      borderOpacity: 0.5,
      blendMode: 'Multiply'
    };
    
    page.drawSvgPath("M 10 10 L 100 100", drawOpts);
    
    const savedBytes = await pdfDoc.save({ useObjectStreams: false });
    console.log("Success! size:", savedBytes.length);
  } catch (e) {
    console.error("Failed:", e.message);
  }
})();
