const fs = require('fs');
let fmCode = fs.readFileSync('src/components/FileManager.tsx', 'utf-8');

fmCode = fmCode.replace(/import \{ getLocalDocuments/g, `import { Capacitor } from '@capacitor/core';\nimport { FilePicker } from '@capawesome/capacitor-file-picker';\nimport { getLocalDocuments`);

const nativeUpload = `
  const handleNativeFileUpload = async () => {
    try {
      const result = await FilePicker.pickFiles({
        types: ['application/pdf'],
        multiple: true,
        readData: true
      });
      
      let hasError = false;
      for (const file of result.files) {
        if (!file.data) continue;
        const binaryString = window.atob(file.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const newDoc: LocalDocument = {
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size || bytes.byteLength,
          data: bytes.buffer,
          isBackedUp: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await saveLocalDocument(newDoc);
      }
      
      if (!hasError) {
        const updated = await getLocalDocuments();
        setDocuments(updated);
      }
    } catch (e: any) {
      if (e.message !== 'pickFiles canceled.') {
        alert("Failed to pick files: " + e.message);
      }
    }
  };
`;

fmCode = fmCode.replace('  const handleFileUpload = async', nativeUpload + '\n  const handleFileUpload = async');

// Change the plus button onClick if native
fmCode = fmCode.replace(/<button\s+onClick=\{\(\) => fileInputRef.current\?.click\(\)\}\s+className="w-14 h-14 bg-red-600/g, 
`<button 
    onClick={() => Capacitor.isNativePlatform() ? handleNativeFileUpload() : fileInputRef.current?.click()}
    className="w-14 h-14 bg-red-600`);

// And the empty state button
fmCode = fmCode.replace(/<button\s+onClick=\{\(\) => fileInputRef.current\?.click\(\)\}\s+className="px-6 py-3 bg-red-600/g, 
`<button 
    onClick={() => Capacitor.isNativePlatform() ? handleNativeFileUpload() : fileInputRef.current?.click()}
    className="px-6 py-3 bg-red-600`);

fs.writeFileSync('src/components/FileManager.tsx', fmCode);
