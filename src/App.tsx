/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { FileManager } from './components/FileManager';
import { PdfViewer } from './components/PdfViewer';
import { ThemeProvider } from './components/ThemeContext';
import { SettingsProvider } from './components/SettingsContext';
import { ToastProvider, useToast } from './components/Toast';
import { LocalDocument } from './types';
import { PDFDocument } from 'pdf-lib';
import { saveLocalDocument } from './lib/idb';
import { App as CapApp } from '@capacitor/app';

import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor, registerPlugin } from '@capacitor/core';
const JetpackPdf = registerPlugin('JetpackPdf');
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function AppContent() {
  const [activeDoc, setActiveDoc] = useState<LocalDocument | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { showToast } = useToast();

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
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
              showToast("PDF imported successfully", "success");
            } catch (err) {
              console.error("Failed to load PDF from intent", err);
              try {
                  const fileData = await Filesystem.readFile({ path: data.url });
                  const binaryString = window.atob(fileData.data as string);
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
                  showToast("PDF imported successfully", "success");
              } catch(e) {
                 showToast("Failed to load external PDF: " + String(e), "error");
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
  }, [showToast]);

  const handleCompressPDF = async (doc: LocalDocument, qualityPercent: number) => {
    try {
      setIsCompressing(true);
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(doc.data.slice(0)) });
      const loadedPdf = await loadingTask.promise;
      
      const newPdf = await PDFDocument.create();
      
      const scale = 0.5 + (qualityPercent / 100) * 1.0; 
      const jpegQuality = 0.1 + (qualityPercent / 100) * 0.7;

      for (let i = 1; i <= loadedPdf.numPages; i++) {
        const page = await loadedPdf.getPage(i);
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        await page.render({ canvasContext: ctx, viewport } as any).promise;
        
        const imgDataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
        const img = await newPdf.embedJpg(imgDataUrl);
        
        const newPage = newPdf.addPage([viewport.width, viewport.height]);
        newPage.drawImage(img, {
          x: 0,
          y: 0,
          width: viewport.width,
          height: viewport.height,
        });
      }
      
      const savedBytes = await newPdf.save({ useObjectStreams: false }); 
       if (savedBytes.length >= doc.size) {
        showToast("Compression stopped: The original PDF is highly optimized text. Kept original.", "info");
        return;
      }
      
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
      showToast(`Compressed version created: "${compressedDoc.name}" (${(compressedDoc.size / 1024 / 1024).toFixed(2)} MB)`, "success");
    } catch (e) {
      console.error(e);
      showToast("Failed to compress PDF: " + (e instanceof Error ? e.message : String(e)), "error");
    } finally {
      setIsCompressing(false);
    }
  };

  return (
    <>
      {!isMounted ? <div className="h-screen w-full bg-white dark:bg-gray-900 sepia:bg-sepia-50" /> : <div className="h-screen w-full font-sans antialiased animate-in fade-in duration-500 bg-white dark:bg-gray-900 sepia:bg-sepia-50 text-gray-900 dark:text-gray-100 sepia:text-sepia-900 flex flex-col">
        {activeDoc ? (
          <PdfViewer doc={activeDoc} onClose={() => { setActiveDoc(null); setRefreshKey(prev => prev + 1); }} />
        ) : (
          <FileManager 
            key={refreshKey}
            onOpenFile={setActiveDoc} 
            onCompressPDF={handleCompressPDF}
            
          />
        )}
        
        {isCompressing && (
          <div className="fixed bottom-4 left-4 bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-pulse z-50">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Compressing PDF...
          </div>
        )}
      </div>
      }
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
    <SettingsProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </SettingsProvider>
    </ThemeProvider>
  );
}
