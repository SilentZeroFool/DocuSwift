const fs = require('fs');
let content = fs.readFileSync('src/components/PdfViewer.tsx', 'utf8');

const search = `      for (const ann of annotations) {
        if (ann.page > pdfDoc.getPageCount()) continue;
        const page = pdfDoc.getPage(ann.page - 1);
        const { width: pWidth, height: pHeight } = page.getSize();`;

const replace = `      for (const ann of annotations) {
        if (ann.page > pdfDoc.getPageCount()) continue;
        if (ann.points.length < 2) continue; // Skip single-point dots to prevent pdf-lib crash
        const page = pdfDoc.getPage(ann.page - 1);
        const { width: pWidth, height: pHeight } = page.getSize();`;

content = content.replace(search, replace);

const search2 = `        page.drawSvgPath(pathData, {
          borderColor: rgb(r, g, b),
          borderWidth: ann.type === 'highlight' ? Math.max(12, ann.strokeWidth) : Math.max(1.5, ann.strokeWidth),
          borderLineCap: LineCapStyle.Round,
          opacity: alpha,
        });`;

const replace2 = `        page.drawSvgPath(pathData, {
          borderColor: rgb(r, g, b),
          borderWidth: ann.type === 'highlight' ? Math.max(12, ann.strokeWidth) : Math.max(1.5, ann.strokeWidth),
          color: undefined, // Crucial: prevents filling the path with black
          opacity: alpha,
        });`;

content = content.replace(search2, replace2);

fs.writeFileSync('src/components/PdfViewer.tsx', content);
