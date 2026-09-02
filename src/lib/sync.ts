import { getAccessToken } from './firebase';
import { getLocalDocuments, saveLocalDocument } from './idb';
import { LocalDocument } from '../types';

async function getAppFolder(token: string): Promise<string> {
  const query = "name='DocuSwift' and mimeType='application/vnd.google-apps.folder' and trashed=false";
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'DocuSwift',
      mimeType: 'application/vnd.google-apps.folder'
    })
  });
  const createData = await createRes.json();
  return createData.id;
}

export async function syncDocuments() {
  const token = await getAccessToken();
  if (!token) return;

  const folderId = await getAppFolder(token);
  const localDocs = await getLocalDocuments();
  
  const docsToUpload = localDocs.filter(d => !d.isBackedUp);
  
  for (const localDoc of docsToUpload) {
    try {
      const metadata = {
        name: localDoc.name,
        parents: [folderId],
        appProperties: {
          appletId: localDoc.id,
          tags: JSON.stringify(localDoc.tags),
          createdAt: localDoc.createdAt.toString(),
          updatedAt: localDoc.updatedAt.toString()
        }
      };

      
      let cloudFileId = localDoc.cloudPath;
      
      if (!cloudFileId) {
        // Step 1: Create metadata to get an ID in the correct folder
        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(metadata)
        });
        const createData = await createRes.json();
        cloudFileId = createData.id;
      } else {
        // Update metadata
        await fetch(`https://www.googleapis.com/drive/v3/files/${cloudFileId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(metadata)
        });
      }

      // Step 2: Upload actual media
      const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${cloudFileId}?uploadType=media`, {
        method: 'PATCH',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/pdf'
        },
        body: localDoc.data
      });
      const data = await res.json();
      
      await saveLocalDocument({ ...localDoc, isBackedUp: true, cloudPath: cloudFileId });

    } catch (e) {
      console.error('Failed to sync doc up', e);
    }
  }

  try {
    const query = `'${folderId}' in parents and trashed=false`;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,size,appProperties)&pageSize=100`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    const cloudDocs = data.files || [];
    const localIds = new Set(localDocs.map(d => d.id));
    
    for (const cDoc of cloudDocs) {
      const appletId = cDoc.appProperties?.appletId;
      if (appletId && !localIds.has(appletId)) {
        try {
          const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${cDoc.id}?alt=media`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const buffer = await dlRes.arrayBuffer();
          
          await saveLocalDocument({
            id: appletId,
            name: cDoc.name,
            size: Number(cDoc.size || buffer.byteLength),
            createdAt: Number(cDoc.appProperties?.createdAt || Date.now()),
            updatedAt: Number(cDoc.appProperties?.updatedAt || Date.now()),
            tags: JSON.parse(cDoc.appProperties?.tags || '[]'),
            isBackedUp: true,
            cloudPath: cDoc.id,
            data: buffer
          });
        } catch (e) {
          console.error('Failed to fetch doc down', e);
        }
      }
    }
  } catch(e) {
    console.error('Failed to get cloud docs', e);
  }
}
