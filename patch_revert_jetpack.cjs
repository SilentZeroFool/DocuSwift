const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Revert JetpackPdf import
code = code.replace("import { Capacitor, registerPlugin } from '@capacitor/core';\nconst JetpackPdf = registerPlugin('JetpackPdf');", '');
code = code.replace("import { Filesystem, Directory } from '@capacitor/filesystem';", "import { Filesystem } from '@capacitor/filesystem';");

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

code = code.replace(oldOpenFile, '');
code = code.replace('onOpenFile={handleOpenFile}', 'onOpenFile={setActiveDoc}');

// Add a fade-in animation and mounting state to prevent UI flash
code = code.replace('const [isCompressing, setIsCompressing] = useState(false);', 'const [isCompressing, setIsCompressing] = useState(false);\n  const [isMounted, setIsMounted] = useState(false);\n  useEffect(() => { setIsMounted(true); }, []);');

code = code.replace(/<div className="h-screen w-full font-sans antialiased/g, 
  '{!isMounted ? <div className="h-screen w-full bg-white dark:bg-gray-900" /> : <div className="h-screen w-full font-sans antialiased animate-in fade-in duration-500 bg-white dark:bg-gray-900 sepia:bg-sepia-50 text-gray-900 dark:text-gray-100 sepia:text-sepia-900 flex flex-col">');

// Add the closing tag for the ternary
code = code.replace(/<\/div>\s*<\/SettingsProvider>/, '</div>\n        )}\n        </SettingsProvider>');

fs.writeFileSync('src/App.tsx', code);
console.log("Reverted Jetpack and added fade-in!");
