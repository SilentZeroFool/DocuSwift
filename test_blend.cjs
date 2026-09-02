const { PDFDocument, rgb } = require('pdf-lib');
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
    await pdfDoc.save();
    console.log("Success");
})();
