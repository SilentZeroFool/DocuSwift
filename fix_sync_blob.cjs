const fs = require('fs');
let code = fs.readFileSync('src/lib/sync.ts', 'utf-8');

// Replace body: localDoc.data with body: new Blob([localDoc.data], { type: 'application/pdf' })
code = code.replace("body: localDoc.data", "body: new Blob([localDoc.data], { type: 'application/pdf' })");

fs.writeFileSync('src/lib/sync.ts', code);
