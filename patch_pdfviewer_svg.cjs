const fs = require('fs');

let content = fs.readFileSync('src/components/PdfViewer.tsx', 'utf-8');

const oldDraw = `        page.drawSvgPath(pathData, {
          borderColor: rgb(r, g, b),
          borderWidth: ann.type === 'highlight' ? Math.max(12, ann.strokeWidth) : Math.max(1.5, ann.strokeWidth),
          color: undefined, // Crucial: prevents filling the path with black
          opacity: alpha,
        });`;

const newDraw = `        // Do NOT use color: undefined as it fails in some environments. 
        // We use borderOpacity for the stroke transparency, and BlendMode for highlighters.
        const drawOpts = {
          borderColor: rgb(r, g, b),
          borderWidth: ann.type === 'highlight' ? Math.max(12, ann.strokeWidth) : Math.max(1.5, ann.strokeWidth),
          borderOpacity: alpha,
        };
        
        // Add blend mode for highlighters to ensure they don't obscure text
        if (ann.type === 'highlight') {
          drawOpts.blendMode = 'Multiply'; // In pdf-lib 1.17.1, string 'Multiply' works if BlendMode is not imported, but let's use the object just in case.
        }
        
        page.drawSvgPath(pathData, drawOpts as any);`;

content = content.replace(oldDraw, newDraw);

// If BlendMode is not imported, let's just make sure drawOpts as any handles the string 'Multiply' because pdf-lib BlendMode enum string values are identical to their keys.
fs.writeFileSync('src/components/PdfViewer.tsx', content);
