const fs = require('fs');
let code = fs.readFileSync('android/variables.gradle', 'utf-8');
code = code.replace(/minSdkVersion = \d+/, "minSdkVersion = 31");
fs.writeFileSync('android/variables.gradle', code);

let build = fs.readFileSync('android/app/build.gradle', 'utf-8');
if (!build.includes('androidx.pdf:pdf-viewer-fragment')) {
    build = build.replace(/dependencies \{/, "dependencies {\n    implementation 'androidx.pdf:pdf-viewer-fragment:1.0.0-beta01'");
    fs.writeFileSync('android/app/build.gradle', build);
}
