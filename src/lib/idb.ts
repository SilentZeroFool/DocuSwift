import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface DocuDB extends DBSchema {
  documents: {
    key: string;
    value: {
      id: string;
      name: string;
      size: number;
      createdAt: number;
      updatedAt: number;
      tags: string[];
      isBackedUp: boolean;
      cloudPath?: string;
      data: ArrayBuffer; // The PDF file data
    };
    indexes: { 'by-updated': number };
  };
}

let dbPromise: Promise<IDBPDatabase<DocuDB>>;

export function initDB() {
  if (!dbPromise) {
    dbPromise = openDB<DocuDB>('docu-swift', 1, {
      upgrade(db) {
        const store = db.createObjectStore('documents', {
          keyPath: 'id',
        });
        store.createIndex('by-updated', 'updatedAt');
      },
    });
  }
  return dbPromise;
}

export async function getLocalDocuments() {
  const db = await initDB();
  return db.getAllFromIndex('documents', 'by-updated');
}

export async function saveLocalDocument(doc: DocuDB['documents']['value']) {
  const db = await initDB();
  await db.put('documents', doc);
}

export async function getLocalDocument(id: string) {
  const db = await initDB();
  return db.get('documents', id);
}

export async function deleteLocalDocument(id: string) {
  const db = await initDB();
  await db.delete('documents', id);
}
