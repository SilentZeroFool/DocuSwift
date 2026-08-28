import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { doc, getDocs, collection, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage, auth } from './firebase';
import { getLocalDocuments, saveLocalDocument } from './idb';
import { LocalDocument } from '../types';

export async function syncDocuments() {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  
  const localDocs = await getLocalDocuments();
  const docsToUpload = localDocs.filter(d => !d.isBackedUp);
  
  // Upload local changes
  for (const localDoc of docsToUpload) {
    try {
      const storageRef = ref(storage, `users/${uid}/${localDoc.id}.pdf`);
      await uploadBytes(storageRef, localDoc.data);
      const url = await getDownloadURL(storageRef);
      
      const docRef = doc(db, 'users', uid, 'documents', localDoc.id);
      await setDoc(docRef, {
        id: localDoc.id,
        userId: uid,
        name: localDoc.name,
        size: localDoc.size,
        createdAt: localDoc.createdAt,
        updatedAt: localDoc.updatedAt,
        tags: localDoc.tags,
        isBackedUp: true,
        cloudPath: url
      });
      
      await saveLocalDocument({ ...localDoc, isBackedUp: true, cloudPath: url });
    } catch (e) {
      console.error('Failed to sync doc up', e);
    }
  }
  
  // Download missing docs from cloud
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'documents'));
    const cloudDocs = snap.docs.map(d => d.data());
    const localIds = new Set(localDocs.map(d => d.id));
    
    for (const cDoc of cloudDocs) {
      if (!localIds.has(cDoc.id) && cDoc.cloudPath) {
        try {
          const res = await fetch(cDoc.cloudPath);
          const buffer = await res.arrayBuffer();
          await saveLocalDocument({
            id: cDoc.id,
            name: cDoc.name,
            size: cDoc.size,
            createdAt: cDoc.createdAt,
            updatedAt: cDoc.updatedAt,
            tags: cDoc.tags || [],
            isBackedUp: true,
            cloudPath: cDoc.cloudPath,
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
