const fs = require('fs');
let code = fs.readFileSync('src/lib/googleOAuth.ts', 'utf-8');

code = code.replace("  'https://www.googleapis.com/auth/drive.file',\n  'email',\n  'profile',", "  'https://www.googleapis.com/auth/drive.file',");

fs.writeFileSync('src/lib/googleOAuth.ts', code);
