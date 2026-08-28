const fs = require('fs');
let content = fs.readFileSync('src/components/PdfViewer.tsx', 'utf8');

content = content.replace(
  'className="px-3 pt-2 pb-1.5 flex items-center justify-between gap-2 shrink-0 z-20 overflow-x-auto no-scrollbar"',
  'className="px-3 pt-2 pb-1.5 flex flex-wrap items-center justify-between gap-2 shrink-0 z-20"'
);

fs.writeFileSync('src/components/PdfViewer.tsx', content);
