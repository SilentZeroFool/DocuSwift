const fs = require('fs');
let appCode = fs.readFileSync('src/App.tsx', 'utf-8');

appCode = appCode.replace("import { App as CapApp } from '@capacitor/app';", 
`import { App as CapApp } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
const JetpackPdf = registerPlugin('JetpackPdf');`);

const openFileCode = `
  const handleOpenFile = async (doc: LocalDocument) => {
    if (Capacitor.isNativePlatform()) {
      try {
        const base64 = Buffer.from(doc.data).toString('base64');
        const path = \`temp_\${doc.id}.pdf\`;
        const res = await Filesystem.writeFile({
          path,
          data: base64,
          directory: Filesystem.Directory ? Filesystem.Directory.Cache : 'CACHE'
        });
        await JetpackPdf.openPdf({ uri: res.uri });
        
        // When they come back, do we need to read it back?
        // Jetpack PDF (PdfViewerFragment) currently is view-only or annotations don't save back directly without action.
        // For now, let's also fallback to our PdfViewer if Jetpack fails or if we want to ensure annotations work in our viewer too.
      } catch (e) {
        console.error("Native PDF failed:", e);
        setActiveDoc(doc);
      }
    } else {
      setActiveDoc(doc);
    }
  };
`;

appCode = appCode.replace('  const [isCompressing, setIsCompressing] = useState(false);', '  const [isCompressing, setIsCompressing] = useState(false);\n' + openFileCode);
appCode = appCode.replace('onOpenFile={setActiveDoc}', 'onOpenFile={handleOpenFile}');
appCode = appCode.replace('import { Filesystem } from', 'import { Filesystem, Directory } from');

fs.writeFileSync('src/App.tsx', appCode);

