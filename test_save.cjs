const { PDFDocument, rgb, LineCapStyle } = require('pdf-lib');
const fs = require('fs');

(async () => {
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    
    // Simulate our save function
    const pWidth = 595;
    const pHeight = 842;
    
    let r = 0.9, g = 0.2, b = 0.2, alpha = 1.0;
    const pathData = "M 100 100 L 200 200";
    
    page.drawSvgPath(pathData, {
      borderColor: rgb(r, g, b),
      borderWidth: 12,
      borderLineCap: LineCapStyle.Round,
      color: undefined,
      opacity: alpha,
    });
    
    const savedBytes = await pdfDoc.save({ useObjectStreams: false });
    console.log("Save successful. Bytes:", savedBytes.length);
  } catch(e) {
    console.error("Save failed:", e);
  }
})();
