/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { FileManager } from './components/FileManager';
import { PdfViewer } from './components/PdfViewer';
import { ThemeProvider } from './components/ThemeContext';
import { LocalDocument } from './types';
import { auth } from './lib/firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { syncDocuments } from './lib/sync';
import { PDFDocument } from 'pdf-lib';
import { saveLocalDocument } from './lib/idb';
import { App as CapApp } from '@capacitor/app';
import { Filesystem } from '@capacitor/filesystem';

export default function App() {
  const [activeDoc, setActiveDoc] = useState<LocalDocument | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));

    const initIntentHandler = async () => {
      try {
        await CapApp.addListener('appUrlOpen', async (data) => {
          if (data.url.toLowerCase().endsWith('.pdf') || data.url.startsWith('file://') || data.url.startsWith('content://')) {
            try {
              const fileData = await Filesystem.readFile({ path: data.url });
              const binaryString = atob(fileData.data as string);
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
            } catch (err) {
              console.error("Failed to load PDF from intent", err);
              alert("Failed to load PDF: " + String(err));
            }
          }
        });
      } catch (e) {
        console.warn("Capacitor App plugin not available", e);
      }
    };
    initIntentHandler();

    return () => {
      unsub();
      CapApp.removeAllListeners();
    };
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error(e);
      alert("Login failed");
    }
  };

  const handleSync = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      await syncDocuments();
      alert("Sync completed!");
    } catch (e) {
      alert("Sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCompressPDF = async (doc: LocalDocument) => {
    try {
      const pdfDoc = await PDFDocument.load(new Uint8Array(doc.data), { ignoreEncryption: true });
      const savedBytes = await pdfDoc.save({ useObjectStreams: false }); 
      
      const compressedDoc: LocalDocument = {
        ...doc,
        id: crypto.randomUUID(),
        name: `Compressed_${doc.name}`,
        size: savedBytes.length,
        data: savedBytes.buffer.slice(savedBytes.byteOffset, savedBytes.byteOffset + savedBytes.byteLength) as ArrayBuffer,
        isBackedUp: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      await saveLocalDocument(compressedDoc);
      setRefreshKey(k => k + 1);
      alert(`Compressed version created: "${compressedDoc.name}" (${(compressedDoc.size / 1024 / 1024).toFixed(2)} MB)`);
    } catch (e) {
      console.error(e);
      alert("Failed to compress PDF");
    }
  };

  return (
    <ThemeProvider>
      <div className="h-screen w-full font-sans antialiased bg-white dark:bg-gray-900 sepia:bg-sepia-50 text-gray-900 dark:text-gray-100 sepia:text-sepia-900 flex flex-col">
        {activeDoc ? (
          <PdfViewer doc={activeDoc} onClose={() => setActiveDoc(null)} />
        ) : (
          <FileManager 
            key={refreshKey}
            onOpenFile={setActiveDoc} 
            onCompressPDF={handleCompressPDF}
            onSync={handleSync}
            user={user}
            onLogin={handleLogin}
          />
        )}
        
        {isSyncing && (
          <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-pulse">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Syncing documents...
          </div>
        )}
      </div>
    </ThemeProvider>
  );
}
