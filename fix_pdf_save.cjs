const fs = require('fs');
let code = fs.readFileSync('src/components/PdfViewer.tsx', 'utf-8');

const oldSave = `      let savedBytes;
      try {
        savedBytes = await pdfDoc.save(); 
      } catch (saveErr) {
        console.warn("Standard save failed, trying without object streams", saveErr);
        savedBytes = await pdfDoc.save({ useObjectStreams: false });
      }`;

const newSave = `      let savedBytes;
      try {
        savedBytes = await pdfDoc.save(); 
      } catch (saveErr: any) {
        if (saveErr.message && saveErr.message.toLowerCase().includes('password')) {
            console.warn("Encrypted PDF detected on save, rebuilding PDF to strip encryption...");
            const newPdf = await PDFDocument.create();
            const copiedPages = await newPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
            copiedPages.forEach((page) => newPdf.addPage(page));
            savedBytes = await newPdf.save({ useObjectStreams: false });
        } else {
            console.warn("Standard save failed, trying without object streams", saveErr);
            savedBytes = await pdfDoc.save({ useObjectStreams: false });
        }
      }`;

code = code.replace(oldSave, newSave);
fs.writeFileSync('src/components/PdfViewer.tsx', code);
console.log("Replaced save block.");
