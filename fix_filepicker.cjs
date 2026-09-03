const fs = require('fs');
let fmCode = fs.readFileSync('src/components/FileManager.tsx', 'utf-8');

const badUpload = `const result = await FilePicker.pickFiles({
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
        }`;

const goodUpload = `const result = await FilePicker.pickFiles({
        types: ['application/pdf'],
        multiple: true,
        readData: false
      });
      
      let hasError = false;
      for (const file of result.files) {
        let bytes: Uint8Array;
        
        // On Android/iOS, file.path is available.
        if (file.path && Capacitor.isNativePlatform()) {
            const url = Capacitor.convertFileSrc(file.path);
            const res = await fetch(url);
            const buf = await res.arrayBuffer();
            bytes = new Uint8Array(buf);
        } else if (file.data) {
            const binaryString = window.atob(file.data);
            bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
        } else if (file.blob) {
            const buf = await file.blob.arrayBuffer();
            bytes = new Uint8Array(buf);
        } else {
            console.warn("Could not read file data");
            continue;
        }`;

fmCode = fmCode.replace(badUpload, goodUpload);
fs.writeFileSync('src/components/FileManager.tsx', fmCode);
