const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const targetMethod = '  const handleOpenFile = async (doc: LocalDocument) => {';
const fallbackMethod = `  const handleOpenFile = async (doc: LocalDocument) => {
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

// Find where handleOpenFile is defined or where to inject it
if (code.includes('const handleOpenFile')) {
  // replace the existing one
  const startIdx = code.indexOf('const handleOpenFile');
  const endIdx = code.indexOf('useEffect(() => {\n    const initIntentHandler', startIdx);
  if (startIdx > -1 && endIdx > -1) {
     const block = code.substring(startIdx, endIdx);
     code = code.replace(block, fallbackMethod + '\n\n  ');
  }
}

fs.writeFileSync('src/App.tsx', code);
