const fs = require('fs');
let code = fs.readFileSync('android/app/build.gradle', 'utf-8');
if (!code.includes('androidx.pdf:pdf-viewer-fragment')) {
    code = code.replace("dependencies {", "dependencies {\n    implementation 'androidx.pdf:pdf-viewer-fragment:1.0.0-beta01'");
    fs.writeFileSync('android/app/build.gradle', code);
}
