const fs = require('fs');
let code = fs.readFileSync('src/components/PdfViewer.tsx', 'utf-8');

// Fix the import
code = code.replace("import { PDFDocument, rgb, LineCapStyle } from 'pdf-lib';", "import { PDFDocument, rgb, LineCapStyle, BlendMode } from 'pdf-lib';");

fs.writeFileSync('src/components/PdfViewer.tsx', code);
