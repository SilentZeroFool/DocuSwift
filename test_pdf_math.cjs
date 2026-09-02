const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');

(async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([500, 500]); // 500x500
    
    // Draw a square using PDF primitives to mark (100, 400)
    page.drawRectangle({ x: 95, y: 395, width: 10, height: 10, color: rgb(0,1,0) });
    
    // Draw SVG path to (100, 400)
    const rawX = 100;
    const rawY = 400; // Expected to land exactly on the green square
    const pathData = `M ${rawX} ${-rawY} L ${rawX+50} ${-(rawY-50)}`;
    
    const drawOpts = {
      borderColor: rgb(1, 0, 0),
      borderWidth: 5,
    };
    
    page.drawSvgPath(pathData, drawOpts);
    
    const bytes = await pdfDoc.save({ useObjectStreams: false });
    fs.writeFileSync('test_math.pdf', bytes);
    
    // Let's decode and see the raw operators!
    const loaded = await PDFDocument.load(bytes);
    console.log(Buffer.from(loaded.getPage(0).node.Contents().lookup().contents).toString());
})();
