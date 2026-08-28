import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { ArrowLeft, ZoomIn, ZoomOut, Save, Download, Highlighter, PenTool, Eraser, Move } from 'lucide-react';
import { LocalDocument } from '../types';
import { PDFDocument, rgb } from 'pdf-lib';
import { saveLocalDocument } from '../lib/idb';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PdfViewerProps {
  doc: LocalDocument;
  onClose: () => void;
}

type Tool = 'pan' | 'highlight' | 'draw' | 'erase';

interface Annotation {
  type: 'highlight' | 'draw';
  page: number;
  points: { x: number, y: number }[];
  color: string;
}

export function PdfViewer({ doc, onClose }: PdfViewerProps) {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [scale, setScale] = useState(1.0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [activeTool, setActiveTool] = useState<Tool>('pan');
  const [isDrawing, setIsDrawing] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [currentPath, setCurrentPath] = useState<{x: number, y: number}[]>([]);

  // Load PDF
  useEffect(() => {
    const loadPDF = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(doc.data) });
        const loadedPdf = await loadingTask.promise;
        setPdf(loadedPdf);
        setPageNum(1);
      } catch (e) {
        console.error("Error loading PDF", e);
        alert("Failed to load PDF.");
      }
    };
    loadPDF();
  }, [doc]);

  // Render Page
  useEffect(() => {
    if (!pdf || !canvasRef.current || !drawCanvasRef.current) return;

    let renderTask: pdfjsLib.RenderTask | null = null;
    let isCancelled = false;

    const renderPage = async () => {
      try {
        const page = await pdf.getPage(pageNum);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const drawCanvas = drawCanvasRef.current;
        
        if (!canvas || !drawCanvas) return;
        
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        drawCanvas.height = viewport.height;
        drawCanvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;
        
        redrawAnnotations();
      } catch (e) {
        if (e instanceof pdfjsLib.RenderingCancelledException) {
          // Expected when rendering is cancelled
        } else {
          console.error('Render error:', e);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdf, pageNum, scale, annotations]);

  const redrawAnnotations = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const pageAnns = annotations.filter(a => a.page === pageNum);
    
    pageAnns.forEach(ann => {
      if (ann.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(ann.points[0].x * scale, ann.points[0].y * scale);
      for (let i = 1; i < ann.points.length; i++) {
        ctx.lineTo(ann.points[i].x * scale, ann.points[i].y * scale);
      }
      
      if (ann.type === 'highlight') {
        ctx.strokeStyle = ann.color; // e.g. 'rgba(255, 255, 0, 0.4)'
        ctx.lineWidth = 20 * scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'multiply';
      } else {
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = 2 * scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.stroke();
    });
    
    ctx.globalCompositeOperation = 'source-over';
    
    // Draw current path
    if (currentPath.length > 1) {
      ctx.beginPath();
      ctx.moveTo(currentPath[0].x * scale, currentPath[0].y * scale);
      for (let i = 1; i < currentPath.length; i++) {
        ctx.lineTo(currentPath[i].x * scale, currentPath[i].y * scale);
      }
      if (activeTool === 'highlight') {
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.4)';
        ctx.lineWidth = 20 * scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'multiply';
      } else if (activeTool === 'draw') {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2 * scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.stroke();
    }
  };

  useEffect(() => {
    redrawAnnotations();
  }, [currentPath]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTool === 'pan') return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    
    if (activeTool === 'erase') {
      // Simple eraser: remove annotations near click
      const newAnns = annotations.filter(ann => {
        if (ann.page !== pageNum) return true;
        const hit = ann.points.some(p => Math.hypot(p.x - x, p.y - y) < 20);
        return !hit;
      });
      setAnnotations(newAnns);
      return;
    }

    setIsDrawing(true);
    setCurrentPath([{x, y}]);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    
    setCurrentPath(prev => [...prev, {x, y}]);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    if (currentPath.length > 1) {
      setAnnotations(prev => [...prev, {
        type: activeTool === 'highlight' ? 'highlight' : 'draw',
        page: pageNum,
        points: currentPath,
        color: activeTool === 'highlight' ? 'rgba(255, 255, 0, 0.4)' : '#ef4444'
      }]);
    }
    setCurrentPath([]);
  };

  const handleSave = async () => {
    if (annotations.length === 0) {
      alert("No annotations to save.");
      return;
    }
    
    try {
      const pdfDoc = await PDFDocument.load(doc.data);
      
      for (const ann of annotations) {
        const page = pdfDoc.getPage(ann.page - 1);
        const { height } = page.getSize();
        
        // Convert paths to SVG paths or draw lines
        for (let i = 1; i < ann.points.length; i++) {
          const p1 = ann.points[i-1];
          const p2 = ann.points[i];
          // PDF coordinates have origin at bottom-left
          page.drawLine({
            start: { x: p1.x, y: height - p1.y },
            end: { x: p2.x, y: height - p2.y },
            thickness: ann.type === 'highlight' ? 20 : 2,
            color: ann.type === 'highlight' ? rgb(1, 1, 0) : rgb(0.9, 0.2, 0.2),
            opacity: ann.type === 'highlight' ? 0.4 : 1,
          });
        }
      }
      
      const savedBytes = await pdfDoc.save();
      
      // Update locally
      await saveLocalDocument({
        ...doc,
        data: savedBytes.buffer,
        updatedAt: Date.now(),
        size: savedBytes.length
      });
      
      alert("Annotations saved successfully!");
      setAnnotations([]); // Clear transient annotations since they are baked in
      
      // Reload PDF
      const loadingTask = pdfjsLib.getDocument({ data: savedBytes });
      const loadedPdf = await loadingTask.promise;
      setPdf(loadedPdf);
      
    } catch (e) {
      console.error(e);
      alert("Error saving PDF.");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([doc.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY * -0.01;
      setScale(s => Math.min(Math.max(0.5, s + delta), 3.0));
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-950 sepia:bg-sepia-100 overflow-hidden">
      <header className="bg-white dark:bg-gray-900 sepia:bg-sepia-50 p-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 sepia:border-sepia-100 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 sepia:hover:bg-sepia-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="font-semibold truncate max-w-[200px] sm:max-w-xs">{doc.name}</h2>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2 bg-gray-100 dark:bg-gray-800 sepia:bg-sepia-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTool('pan')} 
            className={`p-2 rounded-lg transition-colors ${activeTool === 'pan' ? 'bg-white dark:bg-gray-700 sepia:bg-sepia-50 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-gray-700 sepia:hover:bg-sepia-200 text-gray-500'}`}
            title="Pan/Move"
          >
            <Move className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setActiveTool('highlight')} 
            className={`p-2 rounded-lg transition-colors ${activeTool === 'highlight' ? 'bg-yellow-100 text-yellow-700 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-gray-700 sepia:hover:bg-sepia-200 text-gray-500'}`}
            title="Highlight Text"
          >
            <Highlighter className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setActiveTool('draw')} 
            className={`p-2 rounded-lg transition-colors ${activeTool === 'draw' ? 'bg-red-100 text-red-700 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-gray-700 sepia:hover:bg-sepia-200 text-gray-500'}`}
            title="Draw"
          >
            <PenTool className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setActiveTool('erase')} 
            className={`p-2 rounded-lg transition-colors ${activeTool === 'erase' ? 'bg-gray-300 dark:bg-gray-600 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-gray-700 sepia:hover:bg-sepia-200 text-gray-500'}`}
            title="Erase"
          >
            <Eraser className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {annotations.length > 0 && (
            <button onClick={handleSave} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
              <Save className="w-4 h-4" /> <span className="hidden sm:inline">Save</span>
            </button>
          )}
          <button onClick={handleDownload} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 sepia:hover:bg-sepia-100 rounded-lg transition-colors text-gray-600 dark:text-gray-300">
            <Download className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto relative touch-none" ref={containerRef} onWheel={handleWheel}>
        <div className="min-h-full flex items-center justify-center p-4">
          <div className="relative shadow-2xl transition-transform" style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
            <canvas ref={canvasRef} className="block bg-white" />
            <canvas 
              ref={drawCanvasRef} 
              className={`absolute inset-0 cursor-${activeTool === 'pan' ? 'grab' : 'crosshair'} touch-none`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
          </div>
        </div>
      </div>

      <footer className="bg-white dark:bg-gray-900 sepia:bg-sepia-50 p-3 flex items-center justify-center gap-6 border-t border-gray-200 dark:border-gray-800 sepia:border-sepia-100 z-10">
        <button 
          onClick={() => setPageNum(Math.max(1, pageNum - 1))}
          disabled={pageNum <= 1}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-800 sepia:bg-sepia-100 rounded-lg disabled:opacity-50"
        >
          Previous
        </button>
        <span className="font-medium text-sm">
          Page {pageNum} of {pdf?.numPages || '?'}
        </span>
        <button 
          onClick={() => setPageNum(Math.min(pdf?.numPages || 1, pageNum + 1))}
          disabled={!pdf || pageNum >= pdf.numPages}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-800 sepia:bg-sepia-100 rounded-lg disabled:opacity-50"
        >
          Next
        </button>
        
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-2"></div>
        
        <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className="p-2 bg-gray-100 dark:bg-gray-800 sepia:bg-sepia-100 rounded-lg">
          <ZoomOut className="w-5 h-5" />
        </button>
        <span className="text-sm font-medium w-12 text-center">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => Math.min(3.0, s + 0.2))} className="p-2 bg-gray-100 dark:bg-gray-800 sepia:bg-sepia-100 rounded-lg">
          <ZoomIn className="w-5 h-5" />
        </button>
      </footer>
    </div>
  );
}
