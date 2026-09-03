const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const emptyEffect = `  useEffect(() => {
    return () => { CapApp.removeAllListeners(); };
  }, []);`;

const restoredEffect = `  useEffect(() => {
    const initIntentHandler = async () => {
      try {
        await CapApp.addListener('appUrlOpen', async (data) => {
          if (data.url.toLowerCase().endsWith('.pdf') || data.url.startsWith('file://') || data.url.startsWith('content://')) {
            try {
              let urlToFetch = data.url;
              if (data.url.startsWith('file://') || data.url.startsWith('content://')) {
                  urlToFetch = Capacitor.convertFileSrc(data.url);
              }
              const fetchRes = await fetch(urlToFetch);
              const arrayBuf = await fetchRes.arrayBuffer();
              const bytes = new Uint8Array(arrayBuf);
              
              const newDoc: LocalDocument = {
                id: crypto.randomUUID(),
                name: data.url.split('/').pop() || 'Imported_Document.pdf',
                size: bytes.length,
                data: bytes.buffer.slice(0) as ArrayBuffer,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                tags: [],
                isBackedUp: false
              };
              await saveLocalDocument(newDoc);
              setActiveDoc(newDoc);
              setRefreshKey(k => k + 1);
            } catch (err) {
              console.error("Failed to load PDF from intent", err);
              // Fallback to Filesystem.readFile if fetch fails (due to content:// strictness)
              try {
                  const fileData = await Filesystem.readFile({ path: data.url });
                  const binaryString = window.atob(fileData.data);
                  const len = binaryString.length;
                  const bytes = new Uint8Array(len);
                  for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  const newDoc: LocalDocument = {
                    id: crypto.randomUUID(),
                    name: data.url.split('/').pop() || 'Imported_Document.pdf',
                    size: bytes.length,
                    data: bytes.buffer.slice(0) as ArrayBuffer,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    tags: [],
                    isBackedUp: false
                  };
                  await saveLocalDocument(newDoc);
                  setActiveDoc(newDoc);
                  setRefreshKey(k => k + 1);
              } catch(e) {
                 alert("Failed to load external PDF: " + String(e));
              }
            }
          }
        });
      } catch (e) {
        console.warn("Capacitor App plugin not available", e);
      }
    };
    initIntentHandler();
    return () => { CapApp.removeAllListeners(); };
  }, []);`;

code = code.replace(emptyEffect, restoredEffect);
code = code.replace("import { Filesystem } from '@capacitor/filesystem';", "import { Filesystem } from '@capacitor/filesystem';\nimport { Capacitor } from '@capacitor/core';");
fs.writeFileSync('src/App.tsx', code);
