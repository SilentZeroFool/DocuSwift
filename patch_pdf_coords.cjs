const fs = require('fs');
let code = fs.readFileSync('src/components/PdfViewer.tsx', 'utf-8');

const oldToRaw = `const toRawPoint = (nx: number, ny: number): { x: number; y: number } => {
          switch (rotation) {
            case 90: return { x: ny * pWidth, y: nx * pHeight };
            case 180: return { x: (1 - nx) * pWidth, y: ny * pHeight };
            case 270: return { x: (1 - ny) * pWidth, y: (1 - nx) * pHeight };
            default: return { x: nx * pWidth, y: (1 - ny) * pHeight };
          }
        };`;

const newToRaw = `const toRawPoint = (nx: number, ny: number): { x: number; y: number } => {
          switch (rotation) {
            case 90: return { x: ny * pWidth, y: (1 - nx) * pHeight };
            case 180: return { x: (1 - nx) * pWidth, y: (1 - ny) * pHeight };
            case 270: return { x: (1 - ny) * pWidth, y: nx * pHeight };
            default: return { x: nx * pWidth, y: ny * pHeight };
          }
        };`;

const oldPathMap = `const pathData = ann.points.map((p, i) => {
          const raw = toRawPoint(p.x, p.y);
          return \`\${i === 0 ? 'M' : 'L'} \${raw.x} \${-raw.y}\`;
        }).join(' ');`;

const newPathMap = `const pathData = ann.points.map((p, i) => {
          const raw = toRawPoint(p.x, p.y);
          return \`\${i === 0 ? 'M' : 'L'} \${raw.x} \${raw.y}\`;
        }).join(' ');`;

const oldDrawOpts = `const drawOpts = {
          borderColor: rgb(r, g, b),
          borderWidth: ann.type === 'highlight' ? Math.max(12, ann.strokeWidth) : Math.max(1.5, ann.strokeWidth),
          borderOpacity: alpha,
        };`;

const newDrawOpts = `const drawOpts: any = {
          x: 0,
          y: pHeight,
          borderColor: rgb(r, g, b),
          borderWidth: ann.type === 'highlight' ? Math.max(12, ann.strokeWidth) : Math.max(1.5, ann.strokeWidth),
          borderOpacity: alpha,
        };`;

code = code.replace(oldToRaw, newToRaw);
code = code.replace(oldPathMap, newPathMap);
code = code.replace(oldDrawOpts, newDrawOpts);

fs.writeFileSync('src/components/PdfViewer.tsx', code);
