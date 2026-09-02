const fs = require('fs');
let code = fs.readFileSync('src/components/PdfViewer.tsx', 'utf-8');

if (code.indexOf('BlendMode') === -1) {
  code = code.replace('LineCapStyle } from', 'LineCapStyle, BlendMode } from');
}

code = code.replace("drawOpts.blendMode = 'Multiply';", "drawOpts.blendMode = BlendMode.Multiply;");

fs.writeFileSync('src/components/PdfViewer.tsx', code);
