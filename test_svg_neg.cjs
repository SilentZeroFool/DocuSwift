const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');

(async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([500, 500]); 
    
    // Draw green square at (100, 400)
    page.drawRectangle({ x: 95, y: 395, width: 10, height: 10, color: rgb(0,1,0) });
    
    // Try to hit (100, 400) with SVG path
    // If we use M 100 -400, it should be scaled to 100, 400.
    page.drawSvgPath("M 100 -400 L 200 -400 L 200 -300 Z", {
      borderColor: rgb(1, 0, 0),
      borderWidth: 2,
    });
    
    const bytes = await pdfDoc.save();
    fs.writeFileSync('test_svg_neg.pdf', bytes);
    console.log("Written test_svg_neg.pdf");
})();
