const fs = require('fs');

let appCode = fs.readFileSync('src/App.tsx', 'utf-8');
// Fix isSyncing missing variable
appCode = appCode.replace(/\{isSyncing && \([\s\S]*?\}\)/g, '');
appCode = appCode.replace(/isSyncing/g, 'false'); // in case it missed it

fs.writeFileSync('src/App.tsx', appCode);

// Also delete firebase and sync files entirely to keep the directory clean!
if (fs.existsSync('src/lib/firebase.ts')) fs.unlinkSync('src/lib/firebase.ts');
if (fs.existsSync('src/lib/googleOAuth.ts')) fs.unlinkSync('src/lib/googleOAuth.ts');
if (fs.existsSync('src/lib/sync.ts')) fs.unlinkSync('src/lib/sync.ts');

