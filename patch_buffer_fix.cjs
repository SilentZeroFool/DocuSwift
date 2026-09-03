const fs = require('fs');
let appCode = fs.readFileSync('src/App.tsx', 'utf-8');

appCode = appCode.replace(/const base64 = Buffer\.from\(doc\.data\)\.toString\('base64'\);/, 
`
        let binary = '';
        const bytes = new Uint8Array(doc.data);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = window.btoa(binary);
`);

// Also fix Directory enum
appCode = appCode.replace(/Filesystem\.Directory \? Filesystem\.Directory\.Cache : 'CACHE'/g, `Directory.Cache`);

fs.writeFileSync('src/App.tsx', appCode);
