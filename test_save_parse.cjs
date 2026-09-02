const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');

(async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const drawOpts = {
      borderColor: rgb(1, 0, 0),
      borderWidth: 5,
      borderOpacity: 0.5,
      blendMode: 'Multiply'
    };
    page.drawSvgPath("M 10 10 L 100 100", drawOpts);
    const bytes = await pdfDoc.save({ useObjectStreams: false });
    const text = Buffer.from(bytes).toString('utf-8');
    if (text.includes('/Multiply')) {
      console.log("Found /Multiply in PDF");
    } else {
      console.log("NOT FOUND /Multiply in PDF");
    }
})();
