const fs = require('fs');
let code = fs.readFileSync('android/variables.gradle', 'utf-8');
code = code.replace(/minSdkVersion = 22|minSdkVersion = 24/, "minSdkVersion = 28");
fs.writeFileSync('android/variables.gradle', code);
