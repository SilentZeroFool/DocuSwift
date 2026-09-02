const fs = require('fs');
let code = fs.readFileSync('src/lib/sync.ts', 'utf-8');

// Replace the formData and fetch logic inside syncDocuments for uploading
const newUploadLogic = `
      let cloudFileId = localDoc.cloudPath;
      
      if (!cloudFileId) {
        // Step 1: Create metadata to get an ID in the correct folder
        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            Authorization: \`Bearer \${token}\`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(metadata)
        });
        const createData = await createRes.json();
        cloudFileId = createData.id;
      } else {
        // Update metadata
        await fetch(\`https://www.googleapis.com/drive/v3/files/\${cloudFileId}\`, {
          method: 'PATCH',
          headers: {
            Authorization: \`Bearer \${token}\`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(metadata)
        });
      }

      // Step 2: Upload actual media
      const res = await fetch(\`https://www.googleapis.com/upload/drive/v3/files/\${cloudFileId}?uploadType=media\`, {
        method: 'PATCH',
        headers: { 
          Authorization: \`Bearer \${token}\`,
          'Content-Type': 'application/pdf'
        },
        body: localDoc.data
      });
      const data = await res.json();
      
      await saveLocalDocument({ ...localDoc, isBackedUp: true, cloudPath: cloudFileId });
`;

// Find the boundaries
const startIdx = code.indexOf('const formData = new FormData();');
const endIdx = code.indexOf('await saveLocalDocument({ ...localDoc, isBackedUp: true, cloudPath: data.id });') + 'await saveLocalDocument({ ...localDoc, isBackedUp: true, cloudPath: data.id });'.length;

code = code.substring(0, startIdx) + newUploadLogic + code.substring(endIdx);

fs.writeFileSync('src/lib/sync.ts', code);
