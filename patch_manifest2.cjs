const fs = require('fs');
let manifest = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf-8');
manifest = manifest.replace('<activity android:name=".PdfActivity" android:theme="@style/AppTheme" android:exported="false"></activity>', '');
fs.writeFileSync('android/app/src/main/AndroidManifest.xml', manifest);
