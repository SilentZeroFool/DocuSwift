import React, { useState, useRef, useEffect } from 'react';
import { Search, Upload, File as FileIcon, Tag, MoreVertical, Trash2, Cloud, CloudOff, Sun, Moon, Coffee, Laptop } from 'lucide-react';
import { getLocalDocuments, saveLocalDocument, deleteLocalDocument } from '../lib/idb';
import { LocalDocument } from '../types';
import { useTheme } from './ThemeContext';

interface FileManagerProps {
  onOpenFile: (doc: LocalDocument) => void;
  onCompressPDF: (doc: LocalDocument) => void;
  onSync: () => void;
  user: any;
  onLogin: () => void;
}

export function FileManager({ onOpenFile, onCompressPDF, onSync, user, onLogin }: FileManagerProps) {
  const [documents, setDocuments] = useState<LocalDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();
  
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    const docs = await getLocalDocuments();
    setDocuments(docs.sort((a, b) => b.updatedAt - a.updatedAt));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== 'application/pdf') continue;
      
      const buffer = await file.arrayBuffer();
      const newDoc: LocalDocument = {
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        data: buffer,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [],
        isBackedUp: false
      };
      
      await saveLocalDocument(newDoc);
    }
    await loadDocuments();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this document?')) {
      await deleteLocalDocument(id);
      await loadDocuments();
    }
  };

  const handleAddTag = async (doc: LocalDocument) => {
    const tag = prompt('Enter a tag for this document:');
    if (tag && tag.trim()) {
      const updatedDoc = { ...doc, tags: [...new Set([...doc.tags, tag.trim()])] };
      await saveLocalDocument(updatedDoc);
      await loadDocuments();
    }
  };

  const handleRemoveTag = async (doc: LocalDocument, tagToRemove: string) => {
    const updatedDoc = { ...doc, tags: doc.tags.filter(t => t !== tagToRemove) };
    await saveLocalDocument(updatedDoc);
    await loadDocuments();
  };

  const allTags = Array.from(new Set(documents.flatMap(d => d.tags)));

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTags = selectedTags.length === 0 || selectedTags.every(t => doc.tags.includes(t));
    return matchesSearch && matchesTags;
  });

  const toggleTagFilter = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="p-4 border-b border-gray-200 dark:border-gray-800 sepia:border-sepia-100 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">DocuSwift</h1>
        <div className="flex items-center gap-2">
          <div className="relative group">
            <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 sepia:hover:bg-sepia-100">
              {theme === 'system' ? <Laptop className="w-5 h-5" /> : theme === 'dark' ? <Moon className="w-5 h-5" /> : theme === 'sepia' ? <Coffee className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <div className="absolute right-0 mt-2 py-2 w-32 bg-white dark:bg-gray-900 sepia:bg-sepia-50 rounded-lg shadow-xl border border-gray-100 dark:border-gray-800 sepia:border-sepia-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button onClick={() => setTheme('light')} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 sepia:hover:bg-sepia-100">Light</button>
              <button onClick={() => setTheme('dark')} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 sepia:hover:bg-sepia-100">Dark</button>
              <button onClick={() => setTheme('sepia')} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 sepia:hover:bg-sepia-100">Sepia</button>
              <button onClick={() => setTheme('system')} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 sepia:hover:bg-sepia-100">System</button>
            </div>
          </div>
          {user ? (
            <button onClick={onSync} className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 sepia:hover:bg-sepia-100">
              <Cloud className="w-4 h-4" /> Sync
            </button>
          ) : (
            <button onClick={onLogin} className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 sepia:hover:bg-sepia-100">
              <CloudOff className="w-4 h-4 text-gray-400" /> Sign In
            </button>
          )}
        </div>
      </header>

      <div className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 sepia:bg-sepia-100 border-transparent focus:bg-white dark:focus:bg-gray-900 sepia:focus:bg-sepia-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
          />
        </div>
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="flex-shrink-0 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-medium transition-colors w-full sm:w-auto justify-center"
        >
          <Upload className="w-5 h-5" /> Import PDF
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          accept="application/pdf"
          multiple
          className="hidden" 
        />
      </div>

      {allTags.length > 0 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
          {allTags.map(tag => (
            <button 
              key={tag}
              onClick={() => toggleTagFilter(tag)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                selectedTags.includes(tag) 
                  ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50' 
                  : 'bg-transparent text-gray-600 border-gray-200 hover:bg-gray-50 dark:text-gray-400 dark:border-gray-800 dark:hover:bg-gray-800 sepia:border-sepia-100'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-4">
        {filteredDocs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 space-y-4">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 sepia:bg-sepia-100 rounded-full flex items-center justify-center">
              <FileIcon className="w-8 h-8 opacity-50" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 sepia:text-sepia-900">No documents found</h3>
              <p className="text-sm mt-1 max-w-sm">Import some PDFs to get started, or adjust your search filters.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocs.map(doc => (
              <div key={doc.id} className="group bg-white dark:bg-gray-900 sepia:bg-sepia-50 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 sepia:border-sepia-100 shadow-sm hover:shadow-md transition-all flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 overflow-hidden cursor-pointer flex-1" onClick={() => onOpenFile(doc)}>
                    <div className="p-3 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-xl shrink-0">
                      <FileIcon className="w-6 h-6" />
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="font-semibold truncate" title={doc.name}>{doc.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {(doc.size / 1024 / 1024).toFixed(2)} MB • {new Date(doc.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="relative group/menu shrink-0 ml-2">
                    <button className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-900 sepia:bg-sepia-50 rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 sepia:border-sepia-100 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-10 py-1">
                      <button onClick={() => onOpenFile(doc)} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 sepia:hover:bg-sepia-100">Open</button>
                      <button onClick={() => onCompressPDF(doc)} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 sepia:hover:bg-sepia-100">Compress PDF</button>
                      <button onClick={() => handleAddTag(doc)} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 sepia:hover:bg-sepia-100">Add Tag</button>
                      <hr className="my-1 border-gray-100 dark:border-gray-800 sepia:border-sepia-100" />
                      <button onClick={() => handleDelete(doc.id)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">Delete</button>
                    </div>
                  </div>
                </div>
                
                {doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-auto pt-2">
                    {doc.tags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-800 sepia:bg-sepia-100 px-2 py-1 rounded-md text-xs font-medium text-gray-600 dark:text-gray-400">
                        <Tag className="w-3 h-3" /> {tag}
                        <button onClick={(e) => { e.stopPropagation(); handleRemoveTag(doc, tag); }} className="ml-0.5 hover:text-red-500">&times;</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
