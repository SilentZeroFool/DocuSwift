const fs = require('fs');
let fmCode = fs.readFileSync('src/components/FileManager.tsx', 'utf-8');
fmCode = fmCode.replace(/\{user && \([\s\S]*?<Cloud className="w-5 h-5" \/>[\s\S]*?Backup to Drive[\s\S]*?<\/button>\n\s*\)\}/m, '');
fs.writeFileSync('src/components/FileManager.tsx', fmCode);
