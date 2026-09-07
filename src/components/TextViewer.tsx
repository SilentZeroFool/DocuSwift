import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Save, Share2 } from 'lucide-react';
import { LocalDocument } from '../types';
import { saveLocalDocument } from '../lib/idb';
import { useToast } from './Toast';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

interface TextViewerProps {
  doc: LocalDocument;
  onClose: () => void;
}

export function TextViewer({ doc, onClose }: TextViewerProps) {
  const [content, setContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    try {
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(doc.data);
      setContent(text);
      setHasChanges(false);
    } catch (e) {
      showToast('Failed to read text file', 'error');
    }
  }, [doc]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    if (!hasChanges) setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(content);
      const updatedDoc: LocalDocument = {
        ...doc,
        data: bytes.buffer.slice(0) as ArrayBuffer,
        size: bytes.length,
        updatedAt: Date.now()
      };
      await saveLocalDocument(updatedDoc);
      setHasChanges(false);
      showToast('File saved successfully', 'success');
      
      // Update the prop doc data directly so if we share right after, it's fresh
      doc.data = updatedDoc.data;
      doc.size = updatedDoc.size;
    } catch (err) {
      showToast('Failed to save file', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = async () => {
    if (hasChanges) {
      await handleSave();
    }
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
        const base64Data = btoa(
          new Uint8Array(doc.data).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        const fileName = doc.name;
        
        const res = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache
        });

        await Share.share({
          title: fileName,
          url: res.uri,
          dialogTitle: 'Share or Save File'
        });
      } else {
        const blob = new Blob([doc.data], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Export error:", error);
      showToast("Failed to share file", "error");
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950 sepia:bg-sepia-100 will-change-transform">
      <header className="pt-[max(0.75rem,env(safe-area-inset-top))] px-3 pb-2.5 bg-white dark:bg-gray-900 sepia:bg-sepia-50 border-b border-gray-200 dark:border-gray-800 sepia:border-sepia-200 shadow-xs flex items-center justify-between gap-2 z-30 shrink-0">
        <button 
          onClick={onClose}
          className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 sepia:bg-sepia-100 px-3 py-2 rounded-2xl active:scale-95 transition-all text-xs font-semibold text-gray-700 dark:text-gray-200 shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </button>
        
        <div className="font-semibold text-sm truncate flex-1 text-center px-2 text-gray-900 dark:text-gray-100">
          {doc.name} {hasChanges && '*'}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={handleDownload}
            className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 sepia:bg-sepia-100 rounded-xl active:scale-95 transition-all text-gray-600 dark:text-gray-300"
            title="Share / Download"
          >
            <Share2 className="w-5 h-5" />
          </button>
          
          <button 
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-2xl font-bold text-xs disabled:opacity-50 disabled:active:scale-100 active:scale-95 transition-all shrink-0 shadow-sm"
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">{isSaving ? 'Saving' : 'Save'}</span>
          </button>
        </div>
      </header>
      
      <div className="flex-1 p-2 md:p-4 overflow-hidden relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleTextChange}
          className="w-full h-full p-4 resize-none bg-gray-50 dark:bg-gray-900/50 sepia:bg-sepia-50/50 border border-gray-200 dark:border-gray-800 sepia:border-sepia-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono text-sm leading-relaxed text-gray-900 dark:text-gray-100 sepia:text-sepia-900"
          placeholder="Type here..."
          spellCheck="false"
        />
      </div>
    </div>
  );
}
