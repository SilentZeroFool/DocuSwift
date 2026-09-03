const fs = require('fs');
let manifest = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf-8');
if (!manifest.includes('.PdfActivity')) {
  manifest = manifest.replace('</application>', '    <activity android:name=".PdfActivity" android:theme="@style/AppTheme" android:exported="false"></activity>\n    </application>');
  fs.writeFileSync('android/app/src/main/AndroidManifest.xml', manifest);
}
