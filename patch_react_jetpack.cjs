const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace("import { Filesystem } from '@capacitor/filesystem';", "import { Filesystem, Directory } from '@capacitor/filesystem';");
code = code.replace("import { Capacitor } from '@capacitor/core';", "import { Capacitor, registerPlugin } from '@capacitor/core';\nconst JetpackPdf = registerPlugin('JetpackPdf');");

const oldOpenFile = `  const handleOpenFile = async (doc: LocalDocument) => {
    if (Capacitor.isNativePlatform()) {
      try {
        let binary = '';
        const bytes = new Uint8Array(doc.data);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = window.btoa(binary);
        const path = \`temp_\${doc.id}.pdf\`;
        const res = await Filesystem.writeFile({
          path,
          data: base64,
          directory: Directory.Cache
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
  };`;

const newOpenFile = `  const handleOpenFile = async (doc: LocalDocument) => {
    if (Capacitor.isNativePlatform()) {
      try {
        let binary = '';
        const bytes = new Uint8Array(doc.data);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = window.btoa(binary);
        const path = \`temp_\${doc.id}.pdf\`;
        const res = await Filesystem.writeFile({
          path,
          data: base64,
          directory: Directory.Cache
        });
        
        // Launch the native Jetpack viewer Activity!
        await JetpackPdf.openPdf({ uri: res.uri });
        
      } catch (e) {
        console.error("Native PDF failed:", e);
        setActiveDoc(doc); // Fallback
      }
    } else {
      setActiveDoc(doc); // Web fallback
    }
  };`;

if (!code.includes('await JetpackPdf.openPdf')) {
  // If the old block doesn't exist to replace, let's just replace the whole function definition
  const search = `  const handleOpenFile = async (doc: LocalDocument) => {
    if (Capacitor.isNativePlatform()) {
      try {
        let binary = '';
        const bytes = new Uint8Array(doc.data);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = window.btoa(binary);
        const path = \`temp_\${doc.id}.pdf\`;
        const res = await Filesystem.writeFile({
          path,
          data: base64,
          directory: Directory.Cache
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
  };`;
  code = code.replace(search, newOpenFile);
}

fs.writeFileSync('src/App.tsx', code);
