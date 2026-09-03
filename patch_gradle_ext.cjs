const fs = require('fs');
let code = fs.readFileSync('android/app/build.gradle', 'utf-8');
code = code.replace("compileSdk = rootProject.ext.compileSdkVersion", "compileSdk = rootProject.ext.compileSdkVersion\n    compileSdkExtension = 19");
fs.writeFileSync('android/app/build.gradle', code);
