const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  `const scale = 1.0 + (qualityPercent / 100) * 1.5; \n      const jpegQuality = 0.2 + (qualityPercent / 100) * 0.7;`,
  `// Lower scaling to ensure compressed files are smaller
      const scale = 0.5 + (qualityPercent / 100) * 1.0; 
      const jpegQuality = 0.1 + (qualityPercent / 100) * 0.7;`
);

content = content.replace(
  `const savedBytes = await newPdf.save({ useObjectStreams: false }); \n      \n      const compressedDoc: LocalDocument = {`,
  `const savedBytes = await newPdf.save({ useObjectStreams: false }); 
      
      if (savedBytes.length >= doc.size) {
        alert("Compression stopped: The original PDF is highly optimized text. Converting it to compressed images increases the file size. Kept original.");
        return;
      }
      
      const compressedDoc: LocalDocument = {`
);

fs.writeFileSync('src/App.tsx', content);
