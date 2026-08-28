const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  '<PdfViewer doc={activeDoc} onClose={() => setActiveDoc(null)} />',
  '<PdfViewer doc={activeDoc} onClose={() => { setActiveDoc(null); setRefreshKey(prev => prev + 1); }} />'
);

fs.writeFileSync('src/App.tsx', content);
