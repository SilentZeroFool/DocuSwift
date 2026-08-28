import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, Upload, File as FileIcon, Tag, MoreVertical, Trash2, Cloud, CloudOff, 
  Sun, Moon, Coffee, Laptop, X, FileText, Minimize2, Download, Eye, Plus, Check, Share2
} from 'lucide-react';
import { getLocalDocuments, saveLocalDocument, deleteLocalDocument } from '../lib/idb';
import { LocalDocument } from '../types';
import { useTheme } from './ThemeContext';

interface FileManagerProps {
  key?: React.Key;
  onOpenFile: (doc: LocalDocument) => void;
  onCompressPDF: (doc: LocalDocument, qualityPercent: number) => void;
  onSync: () => void;
  user: any;
  onLogin: () => void;
}

export function FileManager({ onOpenFile, onCompressPDF, onSync, user, onLogin }: FileManagerProps) {
  const [documents, setDocuments] = useState<LocalDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [activeMenuDoc, setActiveMenuDoc] = useState<LocalDocument | null>(null);
  const [tagModalDoc, setTagModalDoc] = useState<LocalDocument | null>(null);
  const [compressModalDoc, setCompressModalDoc] = useState<LocalDocument | null>(null);
  const [compressionLevel, setCompressionLevel] = useState<number>(50);
  const [newTagInput, setNewTagInput] = useState('');
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
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
    
    setIsImporting(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) continue;
        
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
    } catch (err) {
      console.error('Failed to import file:', err);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (doc: LocalDocument) => {
    if (window.confirm(`Delete "${doc.name}" from your device?`)) {
      await deleteLocalDocument(doc.id);
      setActiveMenuDoc(null);
      await loadDocuments();
    }
  };

  const handleDownload = (doc: LocalDocument) => {
    const blob = new Blob([doc.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setActiveMenuDoc(null);
  };

  const handleAddTagToDoc = async () => {
    if (!tagModalDoc || !newTagInput.trim()) return;
    const tagClean = newTagInput.trim().toLowerCase().replace(/^#/, '');
    if (!tagClean) return;

    const currentTags = tagModalDoc.tags || [];
    if (!currentTags.includes(tagClean)) {
      const updatedDoc: LocalDocument = {
        ...tagModalDoc,
        tags: [...currentTags, tagClean],
        updatedAt: Date.now()
      };
      await saveLocalDocument(updatedDoc);
      setTagModalDoc(updatedDoc);
      await loadDocuments();
    }
    setNewTagInput('');
  };

  const handleRemoveTagFromDoc = async (tagToRemove: string) => {
    if (!tagModalDoc) return;
    const updatedDoc: LocalDocument = {
      ...tagModalDoc,
      tags: (tagModalDoc.tags || []).filter(t => t !== tagToRemove),
      updatedAt: Date.now()
    };
    await saveLocalDocument(updatedDoc);
    setTagModalDoc(updatedDoc);
    await loadDocuments();
  };

  const allTags: string[] = Array.from(new Set(documents.flatMap(d => d.tags || []))).filter((t): t is string => Boolean(t));

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTags = selectedTags.length === 0 || selectedTags.every(t => (doc.tags || []).includes(t));
    return matchesSearch && matchesTags;
  });

  const toggleTagFilter = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden select-none">
      {/* Top Safe Area & Header */}
      <header className="pt-[max(1rem,env(safe-area-inset-top))] px-4 pb-3 border-b border-gray-200 dark:border-gray-800 sepia:border-sepia-100 flex items-center justify-between gap-3 shrink-0 bg-white/95 dark:bg-gray-900/95 sepia:bg-sepia-50/95 backdrop-blur z-20">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight leading-tight">DocuSwift</h1>
            <p className="text-[11px] text-gray-500 font-medium">PDF Reader & Organizer</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Theme Selector Button */}
          <div className="relative">
            <button 
              id="theme-menu-toggle"
              onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
              className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 sepia:hover:bg-sepia-100 active:scale-95 transition-all text-gray-700 dark:text-gray-300"
              aria-label="Toggle theme menu"
            >
              {theme === 'system' ? <Laptop className="w-5 h-5" /> : theme === 'dark' ? <Moon className="w-5 h-5" /> : theme === 'sepia' ? <Coffee className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            {isThemeMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-30" 
                  onClick={() => setIsThemeMenuOpen(false)} 
                />
                <div className="absolute right-0 mt-2 py-1.5 w-36 bg-white dark:bg-gray-800 sepia:bg-sepia-50 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 sepia:border-sepia-200 z-40 animate-in fade-in zoom-in-95 duration-100">
                  <button 
                    onClick={() => { setTheme('light'); setIsThemeMenuOpen(false); }} 
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium ${theme === 'light' ? 'text-blue-600 font-semibold' : 'text-gray-700 dark:text-gray-300'}`}
                  >
                    <Sun className="w-4 h-4" /> Light
                  </button>
                  <button 
                    onClick={() => { setTheme('dark'); setIsThemeMenuOpen(false); }} 
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium ${theme === 'dark' ? 'text-blue-600 font-semibold' : 'text-gray-700 dark:text-gray-300'}`}
                  >
                    <Moon className="w-4 h-4" /> Dark
                  </button>
                  <button 
                    onClick={() => { setTheme('sepia'); setIsThemeMenuOpen(false); }} 
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium ${theme === 'sepia' ? 'text-blue-600 font-semibold' : 'text-gray-700 dark:text-gray-300'}`}
                  >
                    <Coffee className="w-4 h-4" /> Sepia
                  </button>
                  <button 
                    onClick={() => { setTheme('system'); setIsThemeMenuOpen(false); }} 
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium ${theme === 'system' ? 'text-blue-600 font-semibold' : 'text-gray-700 dark:text-gray-300'}`}
                  >
                    <Laptop className="w-4 h-4" /> System
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Sync & User Profile */}
          {user ? (
            <div className="flex items-center gap-2 bg-blue-50/50 dark:bg-blue-900/10 px-2 py-1.5 rounded-xl border border-blue-100 dark:border-blue-900/30">
              <span className="text-[10px] font-semibold text-blue-800 dark:text-blue-300 px-1 truncate max-w-[80px] sm:max-w-[120px]">
                {user.email}
              </span>
              <button 
                onClick={onSync} 
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all shadow-xs"
                title="Sync to Google Drive"
              >
                <Cloud className="w-3.5 h-3.5" /> <span>Sync</span>
              </button>
            </div>
          ) : (
            <button 
              onClick={onLogin} 
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.16,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.6,22 21.5,18.33 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1V11.1Z" />
              </svg>
              <span>Drive Backup</span>
            </button>
          )}
        </div>
      </header>

      {/* Search & Import Controls */}
      <div className="p-4 space-y-3 shrink-0">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input 
            type="text" 
            placeholder="Search documents or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 sepia:bg-sepia-100 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 sepia:focus:bg-sepia-50 outline-none text-sm transition-all shadow-inner"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          className="w-full flex items-center justify-center gap-2.5 bg-blue-600 active:bg-blue-700 hover:bg-blue-650 text-white py-3.5 px-4 rounded-2xl font-semibold text-sm shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all disabled:opacity-50"
        >
          <Upload className="w-5 h-5" /> 
          <span>{isImporting ? 'Importing PDF...' : 'Import PDF Document'}</span>
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

      {/* Tags Filter Chips */}
      {allTags.length > 0 && (
        <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => setSelectedTags([])}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              selectedTags.length === 0
                ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white shadow-sm'
                : 'bg-gray-100 text-gray-600 border-transparent dark:bg-gray-800 dark:text-gray-400 sepia:bg-sepia-100'
            }`}
          >
            All Files ({documents.length})
          </button>
          {allTags.map(tag => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button 
                key={tag}
                onClick={() => toggleTagFilter(tag)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition-all border flex items-center gap-1 ${
                  isSelected 
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                    : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 sepia:bg-sepia-100'
                }`}
              >
                <span>#{tag}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Document List View */}
      <main className="flex-1 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-1">
        {filteredDocs.length === 0 ? (
          <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center text-gray-500 space-y-3">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 sepia:bg-sepia-100 rounded-3xl flex items-center justify-center text-gray-400">
              <FileIcon className="w-8 h-8 opacity-70" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 sepia:text-sepia-900 text-base">No documents found</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-[240px] mx-auto">
                {searchQuery || selectedTags.length > 0 
                  ? 'No documents match your filter. Tap clear to reset.' 
                  : 'Tap "Import PDF Document" above to get started with fast reading and annotating.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pb-8">
            {filteredDocs.map(doc => (
              <div 
                key={doc.id} 
                className="bg-white dark:bg-gray-800/80 sepia:bg-sepia-50 rounded-2xl p-3.5 border border-gray-100 dark:border-gray-700/80 sepia:border-sepia-200 shadow-sm active:scale-[0.99] transition-all flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Document Card Click Target */}
                  <div 
                    className="flex items-center gap-3 overflow-hidden cursor-pointer flex-1 min-w-0" 
                    onClick={() => onOpenFile(doc)}
                  >
                    <div className="w-11 h-11 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
                      <FileIcon className="w-6 h-6" />
                    </div>
                    <div className="overflow-hidden flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate text-gray-900 dark:text-gray-100 sepia:text-sepia-900" title={doc.name}>
                        {doc.name}
                      </h3>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        <span>{formatFileSize(doc.size)}</span>
                        <span>•</span>
                        <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                        {doc.isBackedUp && (
                          <>
                            <span>•</span>
                            <span className="text-blue-600 dark:text-blue-400 flex items-center gap-0.5 font-medium">
                              <Cloud className="w-3 h-3" /> Backed up
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Explicit Three-Dot Button Trigger */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuDoc(doc);
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 shrink-0 transition-colors"
                    aria-label={`Options for ${doc.name}`}
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Document Tags */}
                {doc.tags && doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {doc.tags.map(tag => (
                      <span 
                        key={tag} 
                        className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-700 sepia:bg-sepia-100 px-2 py-0.5 rounded-lg text-[11px] font-medium text-gray-600 dark:text-gray-300"
                      >
                        <Tag className="w-2.5 h-2.5 opacity-60" /> #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Android Mobile Bottom Sheet for Document Options */}
      {activeMenuDoc && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className="fixed inset-0" 
            onClick={() => setActiveMenuDoc(null)} 
          />
          <div className="relative bg-white dark:bg-gray-900 sepia:bg-sepia-50 rounded-t-3xl p-5 shadow-2xl border-t border-gray-100 dark:border-gray-800 sepia:border-sepia-200 z-10 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4" />
            
            {/* Document Header in Sheet */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-gray-100 dark:border-gray-800 sepia:border-sepia-200">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-3 bg-red-50 text-red-600 dark:bg-red-900/30 rounded-2xl shrink-0">
                  <FileIcon className="w-6 h-6" />
                </div>
                <div className="overflow-hidden">
                  <h3 className="font-bold text-base truncate">{activeMenuDoc.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatFileSize(activeMenuDoc.size)} • Last modified {new Date(activeMenuDoc.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setActiveMenuDoc(null)} 
                className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="py-2 space-y-1">
              <button 
                onClick={() => {
                  const doc = activeMenuDoc;
                  setActiveMenuDoc(null);
                  onOpenFile(doc);
                }}
                className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl text-left font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 sepia:hover:bg-sepia-100 active:bg-gray-100 dark:active:bg-gray-700 transition-colors text-gray-900 dark:text-gray-100"
              >
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold">Open & Read</div>
                  <div className="text-xs text-gray-500">View pages with smooth zooming & annotation</div>
                </div>
              </button>

              {user && (
                <button 
                  onClick={() => {
                    setActiveMenuDoc(null);
                    onSync();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl text-left font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 sepia:hover:bg-sepia-100 active:bg-gray-100 dark:active:bg-gray-700 transition-colors text-gray-900 dark:text-gray-100"
                >
                  <div className="p-2 rounded-xl bg-green-50 text-green-600 dark:bg-green-900/30">
                    <Cloud className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold">Backup to Drive</div>
                    <div className="text-xs text-gray-500">Securely sync this document</div>
                  </div>
                </button>
              )}

              <button 
                onClick={() => {
                  const doc = activeMenuDoc;
                  setActiveMenuDoc(null);
                  setCompressModalDoc(doc);
                }}
                className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl text-left font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 sepia:hover:bg-sepia-100 active:bg-gray-100 dark:active:bg-gray-700 transition-colors text-gray-900 dark:text-gray-100"
              >
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/30">
                  <Minimize2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold">Compress PDF</div>
                  <div className="text-xs text-gray-500">Reduce file size for WhatsApp / Email sharing</div>
                </div>
              </button>

              <button 
                onClick={() => {
                  setTagModalDoc(activeMenuDoc);
                  setActiveMenuDoc(null);
                }}
                className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl text-left font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 sepia:hover:bg-sepia-100 active:bg-gray-100 dark:active:bg-gray-700 transition-colors text-gray-900 dark:text-gray-100"
              >
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-900/30">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold">Manage Tags</div>
                  <div className="text-xs text-gray-500">Categorize for quick retrieval</div>
                </div>
              </button>

              <button 
                onClick={() => handleDownload(activeMenuDoc)}
                className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl text-left font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 sepia:hover:bg-sepia-100 active:bg-gray-100 dark:active:bg-gray-700 transition-colors text-gray-900 dark:text-gray-100"
              >
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold">Save / Download Copy</div>
                  <div className="text-xs text-gray-500">Export PDF file to device downloads</div>
                </div>
              </button>

              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 sepia:border-sepia-200">
                <button 
                  onClick={() => handleDelete(activeMenuDoc)}
                  className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl text-left font-semibold text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 active:bg-red-100 transition-colors"
                >
                  <div className="p-2 rounded-xl bg-red-50 text-red-600 dark:bg-red-950/50">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div>Delete from Device</div>
                    <div className="text-xs text-red-400 font-normal">Permanently remove this document</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tag Management Modal */}
      {tagModalDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-900 sepia:bg-sepia-50 rounded-3xl p-5 shadow-2xl border border-gray-100 dark:border-gray-800 sepia:border-sepia-200 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg">Manage Tags</h3>
              <button 
                onClick={() => setTagModalDoc(null)} 
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-4 truncate font-medium">
              Document: {tagModalDoc.name}
            </p>

            <div className="flex gap-2 mb-4">
              <input 
                type="text"
                placeholder="Add new tag..."
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTagToDoc();
                  }
                }}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 sepia:bg-sepia-100 text-sm outline-none border border-transparent focus:border-blue-500"
              />
              <button 
                onClick={handleAddTagToDoc}
                disabled={!newTagInput.trim()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl font-semibold text-sm"
              >
                Add
              </button>
            </div>

            <div className="space-y-1.5 mb-5 max-h-48 overflow-y-auto">
              {(!tagModalDoc.tags || tagModalDoc.tags.length === 0) ? (
                <div className="text-xs text-gray-400 py-3 text-center">No tags assigned yet</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tagModalDoc.tags.map(tag => (
                    <span 
                      key={tag}
                      className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-3 py-1.5 rounded-xl text-xs font-semibold"
                    >
                      #{tag}
                      <button 
                        onClick={() => handleRemoveTagFromDoc(tag)}
                        className="hover:text-red-500 p-0.5 rounded-full"
                        aria-label={`Remove tag ${tag}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button 
              onClick={() => setTagModalDoc(null)}
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl font-semibold text-sm transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
      {/* Compression Modal */}
      {compressModalDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-900 sepia:bg-sepia-50 rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-gray-800 sepia:border-sepia-200 w-full max-w-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-lg">Compress PDF</h3>
              <button 
                onClick={() => setCompressModalDoc(null)} 
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-xs text-gray-500 mb-6 truncate font-medium">
              {compressModalDoc.name} ({formatFileSize(compressModalDoc.size)})
            </p>

            <div className="space-y-4 mb-8">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold flex justify-between">
                  <span>Compression Level</span>
                  <span className="text-blue-600">{compressionLevel}% Quality</span>
                </label>
                <input 
                  type="range" 
                  min="10" 
                  max="100" 
                  step="10"
                  value={compressionLevel} 
                  onChange={(e) => setCompressionLevel(Number(e.target.value))}
                  className="w-full accent-blue-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              
              <div className="flex justify-between text-xs text-gray-500 font-medium px-1">
                <span>Low Size</span>
                <span>Balanced</span>
                <span>High Quality</span>
              </div>
            </div>

            <button 
              onClick={() => {
                const doc = compressModalDoc;
                setCompressModalDoc(null);
                onCompressPDF(doc, compressionLevel);
              }}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-sm shadow-md shadow-blue-500/20 transition-all active:scale-95"
            >
              Start Compression
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
