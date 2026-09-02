const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');

(async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([500, 500]); 
    
    // Draw a green square at (100, 400) in PDF coords (near top-left)
    page.drawRectangle({ x: 95, y: 395, width: 10, height: 10, color: rgb(0,1,0) });
    
    // We want the SVG to also hit (100, 400)
    // If we use pageHeight for Y translation:
    // SVG M 100 100 should map to PDF (100, 400)
    page.drawSvgPath("M 100 100 L 200 100 L 200 200 Z", {
      x: 0,
      y: 500,
      borderColor: rgb(1, 0, 0),
      borderWidth: 2,
    });
    
    const bytes = await pdfDoc.save();
    fs.writeFileSync('test_svg_coords.pdf', bytes);
    console.log("Written test_svg_coords.pdf");
})();
