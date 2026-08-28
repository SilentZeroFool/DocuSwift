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

      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', new Blob([localDoc.data], { type: 'application/pdf' }));

      let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      let method = 'POST';
      
      if (localDoc.cloudPath) {
        url = `https://www.googleapis.com/upload/drive/v3/files/${localDoc.cloudPath}?uploadType=multipart`;
        method = 'PATCH';
      }

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      
      await saveLocalDocument({ ...localDoc, isBackedUp: true, cloudPath: data.id });
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
