const { PDFDocument } = require('pdf-lib');

(async () => {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage([595, 842]);
  
  const bytes = await pdfDoc.save();
  console.log("bytes length:", bytes.length);
  console.log("buffer length:", bytes.buffer.byteLength);
  console.log("byteOffset:", bytes.byteOffset);
})();
