const fs = require('fs');
let code = fs.readFileSync('android/app/build.gradle', 'utf-8');
code = code.replace("implementation 'androidx.pdf:pdf-viewer-fragment:1.0.0-beta01'", '');
fs.writeFileSync('android/app/build.gradle', code);
