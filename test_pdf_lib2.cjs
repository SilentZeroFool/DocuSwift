const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');

(async () => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  
  const pWidth = 595, pHeight = 842;
  const rotation = 0;
  
  const toRawPoint = (nx, ny) => {
    switch (rotation) {
      case 90: return { x: ny * pWidth, y: nx * pHeight };
      case 180: return { x: (1 - nx) * pWidth, y: ny * pHeight };
      case 270: return { x: (1 - ny) * pWidth, y: (1 - nx) * pHeight };
      default: return { x: nx * pWidth, y: (1 - ny) * pHeight };
    }
  };

  const points = [
    { x: 0.1, y: 0.1 },
    { x: 0.9, y: 0.9 }
  ];

  const pathData = points.map((p, i) => {
    const raw = toRawPoint(p.x, p.y);
    return `${i === 0 ? 'M' : 'L'} ${raw.x} ${-raw.y}`;
  }).join(' ');
  
  console.log(pathData);

  page.drawSvgPath(pathData, {
    borderColor: rgb(1, 0, 0),
    borderWidth: 10,
    color: undefined,
  });
  
  const bytes = await pdfDoc.save({ useObjectStreams: false });
  fs.writeFileSync('out3.pdf', bytes);
})();
