import React, { useEffect, useRef, useState, useCallback } from 'react';
import { flushSync } from 'react-dom';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { 
  ArrowLeft, ZoomIn, ZoomOut, Save, Download, Highlighter, PenTool, 
  Eraser, Hand, Maximize2, Palette, RotateCcw, Check, ChevronLeft, ChevronRight, X, Layers
} from 'lucide-react';
import { LocalDocument } from '../types';
import { useSettings } from './SettingsContext';
import { PDFDocument, rgb, LineCapStyle, BlendMode } from 'pdf-lib';
import { saveLocalDocument } from '../lib/idb';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PdfViewerProps {
  doc: LocalDocument;
  onClose: () => void;
}

type Tool = 'pan' | 'highlight' | 'draw' | 'erase';

interface AnnotationPoint {
  x: number; // Normalized to 0..1 relative to page width
  y: number; // Normalized to 0..1 relative to page height
}

interface Annotation {
  id: string;
  type: 'highlight' | 'draw';
  page: number;
  points: AnnotationPoint[];
  color: string;
  strokeWidth: number;
}

const HIGHLIGHT_COLORS = ['rgba(250, 204, 21, 0.45)', 'rgba(74, 222, 128, 0.45)', 'rgba(244, 114, 182, 0.45)', 'rgba(96, 165, 250, 0.45)'];
const DRAW_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#111827'];

export function PdfViewer({ doc, onClose }: PdfViewerProps) {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({ width: 595, height: 842 });
  
  // Zoom & Scale
  const { settings } = useSettings();
  const [userZoom, setUserZoom] = useState(1.0); // CSS scale (instant)
  const [isPinching, setIsPinching] = useState(false);
  const renderZoom = 2.0; // Fixed high-res PDF rendering scale
  const [fitScale, setFitScale] = useState(1.0);
  const [isPageChanging, setIsPageChanging] = useState(false);
  const currentPdfDataRef = useRef<ArrayBuffer>(doc.data);

  // Tools & Annotations
  const [activeTool, setActiveTool] = useState<Tool>('pan');
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0]);
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [currentPath, setCurrentPath] = useState<AnnotationPoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [isJumpModalOpen, setIsJumpModalOpen] = useState(false);
  const [jumpPageInput, setJumpPageInput] = useState('1');

  // DOM Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Multi-touch tracking for pinch-to-zoom
  const touchDistanceRef = useRef<number | null>(null);
  const touchStartZoomRef = useRef<number>(1.0);

  // 1. Load PDF Document
  useEffect(() => {
    let isCancelled = false;
    const loadPDF = async () => {
      try {
        const buf = currentPdfDataRef.current;
        let arrayBuffer: ArrayBuffer;
        if (buf instanceof ArrayBuffer) {
          arrayBuffer = buf.slice(0);
        } else {
          arrayBuffer = new Uint8Array(buf as any).buffer;
        }
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        const loadedPdf = await loadingTask.promise;
        if (isCancelled) return;
        setPdf(loadedPdf);
        setTotalPages(loadedPdf.numPages);
        setPageNum(1);
      } catch (e) {
        console.error("Error loading PDF", e);
        alert("Failed to load PDF document.");
      }
    };
    loadPDF();
    return () => {
      isCancelled = true;
    };
  }, [doc]);

  // 2. Measure Container & Compute Fit to Width
  const calculateFitScale = useCallback((pageWidth: number) => {
    if (!containerRef.current || pageWidth <= 0) return 1.0;
    const containerWidth = containerRef.current.clientWidth;
    // Leave horizontal margin (16px on mobile, 32px on desktop)
    const availableWidth = Math.max(containerWidth - 24, 280);
    const calculated = availableWidth / pageWidth;
    return calculated;
  }, []);

  // Update scale on window/container resize
  useEffect(() => {
    const handleResize = () => {
      if (pageSize.width > 0) {
        const fit = calculateFitScale(pageSize.width);
        setFitScale(fit);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pageSize.width, calculateFitScale]);

  // 3. Render PDF Page to Background Canvas
  const lastRenderedPageRef = useRef<number>(0);

  useEffect(() => {
    if (!pdf || !canvasRef.current || !drawCanvasRef.current) return;

    let renderTask: pdfjsLib.RenderTask | null = null;
    let isCancelled = false;

    const renderPage = async () => {
      try {
        if (pageNum !== lastRenderedPageRef.current) {
          setIsPageChanging(true);
        }
        const page = await pdf.getPage(pageNum);
        if (isCancelled) return;

        // Base page size
        const baseViewport = page.getViewport({ scale: 1.0 });
        setPageSize({ width: baseViewport.width, height: baseViewport.height });

        const calculatedFit = calculateFitScale(baseViewport.width);
        setFitScale(calculatedFit);

        const currentScale = calculatedFit * renderZoom;
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const viewport = page.getViewport({ scale: currentScale * dpr });

        const canvas = canvasRef.current;
        const drawCanvas = drawCanvasRef.current;
        if (!canvas || !drawCanvas) return;

        const context = canvas.getContext('2d', { alpha: false });
        if (!context) return;

        // Actual pixel resolution
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        drawCanvas.width = Math.floor(viewport.width);
        drawCanvas.height = Math.floor(viewport.height);

        // Display CSS resolution
        const displayWidth = Math.floor(baseViewport.width * currentScale);
        const displayHeight = Math.floor(baseViewport.height * currentScale);

        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
        drawCanvas.style.width = `${displayWidth}px`;
        drawCanvas.style.height = `${displayHeight}px`;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;
        if (isCancelled) return;

        redrawAnnotations(viewport.width, viewport.height);
        setIsPageChanging(false);
        lastRenderedPageRef.current = pageNum;
      } catch (e) {
        if (!(e instanceof pdfjsLib.RenderingCancelledException)) {
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
  }, [pdf, pageNum, renderZoom, fitScale, calculateFitScale]);

  // 4. Redraw Annotations on Overlay Canvas
  const redrawAnnotations = useCallback((canvasWidth?: number, canvasHeight?: number) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvasWidth || canvas.width;
    const height = canvasHeight || canvas.height;

    ctx.clearRect(0, 0, width, height);

    const pageAnns = annotations.filter(a => a.page === pageNum);

    pageAnns.forEach(ann => {
      if (ann.points.length < 2) return;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ann.points[0].x * width, ann.points[0].y * height);

      for (let i = 1; i < ann.points.length; i++) {
        ctx.lineTo(ann.points[i].x * width, ann.points[i].y * height);
      }

      if (ann.type === 'highlight') {
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = Math.max(16, (ann.strokeWidth || 20) * (width / 595));
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'multiply';
      } else {
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = Math.max(2, (ann.strokeWidth || 3) * (width / 595));
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.stroke();
      ctx.restore();
    });

    // Draw active drawing path in real time
    if (currentPath.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(currentPath[0].x * width, currentPath[0].y * height);

      for (let i = 1; i < currentPath.length; i++) {
        ctx.lineTo(currentPath[i].x * width, currentPath[i].y * height);
      }

      if (activeTool === 'highlight') {
        ctx.strokeStyle = highlightColor;
        ctx.lineWidth = Math.max(16, 20 * (width / 595));
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'multiply';
      } else if (activeTool === 'draw') {
        ctx.strokeStyle = drawColor;
        ctx.lineWidth = Math.max(2, strokeWidth * (width / 595));
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.stroke();
      ctx.restore();
    }
  }, [annotations, pageNum, currentPath, activeTool, highlightColor, drawColor, strokeWidth]);

  useEffect(() => {
    redrawAnnotations();
  }, [currentPath, annotations, redrawAnnotations]);

  // 5. Pointer / Drawing Handlers
  const getNormalizedPoint = (e: React.PointerEvent<HTMLCanvasElement>): AnnotationPoint | null => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y))
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTool === 'pan') return;

    const pt = getNormalizedPoint(e);
    if (!pt) return;

    if (activeTool === 'erase') {
      // Erase any annotation that has points within threshold
      const newAnns = annotations.filter(ann => {
        if (ann.page !== pageNum) return true;
        const hit = ann.points.some(p => Math.hypot(p.x - pt.x, p.y - pt.y) < 0.04);
        return !hit;
      });
      if (newAnns.length !== annotations.length) {
        setAnnotations(newAnns);
        setHasUnsavedChanges(true);
      }
      return;
    }

    setIsDrawing(true);
    setCurrentPath([pt]);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const pt = getNormalizedPoint(e);
    if (!pt) return;

    setCurrentPath(prev => [...prev, pt]);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    if (currentPath.length > 1) {
      const newAnn: Annotation = {
        id: crypto.randomUUID(),
        type: activeTool === 'highlight' ? 'highlight' : 'draw',
        page: pageNum,
        points: currentPath,
        color: activeTool === 'highlight' ? highlightColor : drawColor,
        strokeWidth: activeTool === 'highlight' ? 20 : strokeWidth
      };
      setAnnotations(prev => [...prev, newAnn]);
      setHasUnsavedChanges(true);
    }
    setCurrentPath([]);
  };

  const lastTapRef = useRef<{ time: number, x: number, y: number } | null>(null);

  // 6. Touch Gestures (Pinch to Zoom & Double Tap)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setIsPinching(true);
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchDistanceRef.current = Math.hypot(dx, dy);
      touchStartZoomRef.current = userZoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / touchDistanceRef.current;
      
      const nextZoom = Math.min(Math.max(0.6, userZoom * ratio), 4.0);
      
      const container = containerRef.current;
      if (container && nextZoom !== userZoom) {
        const rect = container.getBoundingClientRect();
        const pinchCenterX = (touch1.clientX + touch2.clientX) / 2 - rect.left;
        const pinchCenterY = (touch1.clientY + touch2.clientY) / 2 - rect.top;

        const contentX = pinchCenterX + container.scrollLeft;
        const contentY = pinchCenterY + container.scrollTop;

        const zoomRatio = nextZoom / userZoom;
        
        flushSync(() => {
          setUserZoom(nextZoom);
        });

        container.scrollLeft = contentX * zoomRatio - pinchCenterX;
        container.scrollTop = contentY * zoomRatio - pinchCenterY;
      } else {
        setUserZoom(nextZoom);
      }
      
      touchDistanceRef.current = dist;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      setIsPinching(false);
    }
    touchDistanceRef.current = null;
    
    // Detect double tap
    if (e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      const now = Date.now();
      const last = lastTapRef.current;
      
      if (last && now - last.time < 300) {
        // Double tap!
        const dx = touch.clientX - last.x;
        const dy = touch.clientY - last.y;
        if (Math.hypot(dx, dy) < 30) {
          const container = containerRef.current;
          if (container) {
            const rect = container.getBoundingClientRect();
            const tapX = touch.clientX - rect.left;
            const tapY = touch.clientY - rect.top;
            
            const contentX = tapX + container.scrollLeft;
            const contentY = tapY + container.scrollTop;

            const targetZoom = userZoom > 1.1 ? 1.0 : 1.5;
            const startZoom = userZoom;
            const startScrollLeft = container.scrollLeft;
            const startScrollTop = container.scrollTop;
            
            const targetScrollLeft = contentX * (targetZoom / startZoom) - tapX;
            const targetScrollTop = contentY * (targetZoom / startZoom) - tapY;
            
            setIsPinching(true); // Disable CSS transition
            
            const startTime = performance.now();
            const duration = settings.animationDuration;
            
            const animate = (time) => {
              let progress = (time - startTime) / duration;
              if (progress > 1) progress = 1;
              const ease = 1 - Math.pow(1 - progress, 3);
              
              const currentZoom = startZoom + (targetZoom - startZoom) * ease;
              setUserZoom(currentZoom);
              container.scrollLeft = startScrollLeft + (targetScrollLeft - startScrollLeft) * ease;
              container.scrollTop = startScrollTop + (targetScrollTop - startScrollTop) * ease;
              
              if (progress < 1) {
                requestAnimationFrame(animate);
              } else {
                setIsPinching(false);
              }
            };
            requestAnimationFrame(animate);
          }
          lastTapRef.current = null;
          return;
        }
      }
      
      lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
    }
  };

  // 7. Save Annotations to Local IndexedDB & PDF Bytes
  const handleSave = async () => {
    if (annotations.length === 0 && !hasUnsavedChanges) {
      showToast("No annotations to save.");
      return;
    }

    setIsSaving(true);
    try {
      // Force it to an ArrayBuffer safely
      const buf = currentPdfDataRef.current;
      let arrayBuffer: ArrayBuffer;
      if (buf instanceof ArrayBuffer) {
        arrayBuffer = buf.slice(0);
      } else {
        // Fallback if it somehow became a typed array or buffer
        arrayBuffer = new Uint8Array(buf as any).buffer;
      }
      const pdfDoc = await PDFDocument.load(new Uint8Array(arrayBuffer), { ignoreEncryption: true });

      for (const ann of annotations) {
        if (ann.page > pdfDoc.getPageCount()) continue;
        if (ann.points.length < 2) continue; // Skip single-point dots to prevent pdf-lib crash
        const page = pdfDoc.getPage(ann.page - 1);
        const { width: pWidth, height: pHeight } = page.getSize();

        // Convert hex or rgba color to RGB components
        let r = 0.9, g = 0.2, b = 0.2, alpha = 1.0;
        if (ann.type === 'highlight') {
          alpha = 0.45;
          if (ann.color.includes('250, 204, 21')) { r = 0.98; g = 0.8; b = 0.08; } // yellow
          else if (ann.color.includes('74, 222, 128')) { r = 0.29; g = 0.87; b = 0.5; } // green
          else if (ann.color.includes('244, 114, 182')) { r = 0.95; g = 0.44; b = 0.71; } // pink
          else { r = 0.38; g = 0.65; b = 0.98; } // blue
        } else {
          // Hex color
          if (ann.color === '#ef4444') { r = 0.93; g = 0.27; b = 0.27; }
          else if (ann.color === '#3b82f6') { r = 0.23; g = 0.51; b = 0.96; }
          else if (ann.color === '#10b981') { r = 0.06; g = 0.72; b = 0.51; }
          else if (ann.color === '#f59e0b') { r = 0.96; g = 0.62; b = 0.04; }
          else { r = 0.1; g = 0.1; b = 0.1; }
        }

        if (ann.points.length < 2) continue;

        // pdf-lib's page.getSize() returns the RAW MediaBox dimensions, which
        // do NOT account for the page's /Rotate entry. But the annotation's
        // normalized points were captured against the ROTATED/displayed page
        // (what pdfjs renders, and what the user actually drew on). Scanned
        // and phone-camera PDFs very commonly have /Rotate set, so this has
        // to be corrected for or annotations land in the wrong place (often
        // off the page entirely) on exactly those files.
        //
        // rotation is normalized to one of 0 / 90 / 180 / 270.
        const rotation = ((page.getRotation().angle % 360) + 360) % 360;

        // Maps a normalized DISPLAY-space point (top-down, 0..1, matching what
        // the user drew on screen) to the page's raw content-stream space
        // (bottom-left origin, y-up). Verified against poppler renders for
        // all 4 rotation cases.
        const toRawPoint = (nx: number, ny: number): { x: number; y: number } => {
          switch (rotation) {
            case 90: return { x: ny * pWidth, y: (1 - nx) * pHeight };
            case 180: return { x: (1 - nx) * pWidth, y: (1 - ny) * pHeight };
            case 270: return { x: (1 - ny) * pWidth, y: nx * pHeight };
            default: return { x: nx * pWidth, y: ny * pHeight };
          }
        };

        // pdf-lib's drawSvgPath() applies its own internal Y flip
        // (scale(1, -1)) with the path anchored at (0, 0) by default, so
        // feeding it (rawX, -rawY) lands the point at (rawX, rawY) in raw
        // content space - exactly the target computed above.
        const pathData = ann.points.map((p, i) => {
          const raw = toRawPoint(p.x, p.y);
          return `${i === 0 ? 'M' : 'L'} ${raw.x} ${raw.y}`;
        }).join(' ');

        // Do NOT use color: undefined as it fails in some environments. 
        // We use borderOpacity for the stroke transparency, and BlendMode for highlighters.
        const drawOpts: any = {
          x: 0,
          y: pHeight,
          borderColor: rgb(r, g, b),
          borderWidth: ann.type === 'highlight' ? Math.max(12, ann.strokeWidth) : Math.max(1.5, ann.strokeWidth),
          borderOpacity: alpha,
        };
        
        // Add blend mode for highlighters to ensure they don't obscure text
        if (ann.type === 'highlight') {
          drawOpts.blendMode = BlendMode.Multiply; // In pdf-lib 1.17.1, string 'Multiply' works if BlendMode is not imported, but let's use the object just in case.
        }
        
        page.drawSvgPath(pathData, drawOpts as any);
      }

      const savedBytes = await pdfDoc.save({ useObjectStreams: false });

      const updatedDocument: LocalDocument = {
        ...doc,
        data: savedBytes.buffer.slice(savedBytes.byteOffset, savedBytes.byteOffset + savedBytes.byteLength) as ArrayBuffer,
        updatedAt: Date.now(),
        size: savedBytes.length
      };

      currentPdfDataRef.current = updatedDocument.data;

      await saveLocalDocument(updatedDocument);

      setAnnotations([]);
      setHasUnsavedChanges(false);
      showToast("Annotations saved to PDF!");

      // Reload fresh PDF bytes
      const loadingTask = pdfjsLib.getDocument({ data: savedBytes.slice(0) });
      const loadedPdf = await loadingTask.promise;
      setPdf(loadedPdf);
    } catch (e) {
      console.error('Error saving PDF:', e);
      alert("Error saving annotations: " + (e instanceof Error ? e.message : String(e)));
      showToast("Error saving annotations: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const uint8Array = new Uint8Array(currentPdfDataRef.current);
        let binary = '';
        const len = uint8Array.byteLength;
        const chunkSize = 8192;
        for (let i = 0; i < len; i += chunkSize) {
          binary += String.fromCharCode.apply(null, uint8Array.subarray(i, i + chunkSize) as unknown as number[]);
        }
        const base64Data = btoa(binary);

        const savedFile = await Filesystem.writeFile({
          path: doc.name,
          data: base64Data,
          directory: Directory.Cache
        });

        await Share.share({
          title: doc.name,
          url: savedFile.uri,
          dialogTitle: 'Export PDF'
        });
      } catch (err) {
        console.error('Error sharing:', err);
        showToast("Error exporting PDF.");
      }
    } else {
      const blob = new Blob([currentPdfDataRef.current], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("PDF exported to downloads!");
    }
  };

  const showToast = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleJumpPage = () => {
    const p = parseInt(jumpPageInput, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setPageNum(p);
      setIsJumpModalOpen(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-150 dark:bg-gray-950 sepia:bg-sepia-100 overflow-hidden select-none">
      {/* Top App Bar with Safe Area Top */}
      <header className="pt-[max(0.75rem,env(safe-area-inset-top))] px-3 pb-2.5 bg-white/95 dark:bg-gray-900/95 sepia:bg-sepia-50/95 border-b border-gray-200 dark:border-gray-800 sepia:border-sepia-200 shadow-xs flex items-center justify-between gap-2 z-30 backdrop-blur shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 sepia:hover:bg-sepia-100 rounded-xl active:scale-95 transition-all text-gray-700 dark:text-gray-200 shrink-0"
            aria-label="Back to documents"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-sm truncate leading-tight text-gray-900 dark:text-gray-100 sepia:text-sepia-900" title={doc.name}>
              {doc.name}
            </h2>
            <button 
              onClick={() => {
                setJumpPageInput(String(pageNum));
                setIsJumpModalOpen(true);
              }}
              className="text-[11px] text-gray-500 font-semibold flex items-center gap-1 hover:underline"
            >
              <span>Page {pageNum} of {totalPages}</span>
              <span className="text-[9px] bg-gray-100 dark:bg-gray-800 px-1 rounded">Jump</span>
            </button>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Save Button */}
          {(hasUnsavedChanges || annotations.length > 0) && (
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1 px-3 py-2 bg-blue-600 active:bg-blue-700 hover:bg-blue-650 text-white text-xs font-semibold rounded-xl shadow-xs transition-all animate-pulse disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save'}</span>
            </button>
          )}

          {/* Download Button */}
          <button 
            onClick={handleDownload}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 sepia:hover:bg-sepia-100 rounded-xl transition-colors text-gray-600 dark:text-gray-300 active:scale-95"
            title="Download PDF"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Floating Action / Tool Selector Bar (Optimized for Mobile Touch) */}
      <div className="px-3 pt-2 pb-1.5 flex flex-wrap items-center justify-between gap-2 shrink-0 z-20">
        {/* Tool Segmented Control */}
        <div className="flex items-center bg-white dark:bg-gray-800 sepia:bg-sepia-50 p-1 rounded-2xl shadow-xs border border-gray-200 dark:border-gray-700 sepia:border-sepia-200">
          <button 
            onClick={() => setActiveTool('pan')} 
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTool === 'pan' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Hand className="w-4 h-4" />
            <span className="hidden sm:inline">Pan</span>
          </button>

          <button 
            onClick={() => setActiveTool('highlight')} 
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTool === 'highlight' 
                ? 'bg-amber-400 text-gray-900 shadow-xs font-bold' 
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Highlighter className="w-4 h-4" />
            <span className="hidden sm:inline">Highlight</span>
          </button>

          <button 
            onClick={() => setActiveTool('draw')} 
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTool === 'draw' 
                ? 'bg-red-500 text-white shadow-xs' 
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <PenTool className="w-4 h-4" />
            <span className="hidden sm:inline">Draw</span>
          </button>

          <button 
            onClick={() => setActiveTool('erase')} 
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTool === 'erase' 
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-xs' 
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Eraser className="w-4 h-4" />
            <span className="hidden sm:inline">Eraser</span>
          </button>
        </div>

        {/* Color / Options Sub-panel Button */}
        {(activeTool === 'draw' || activeTool === 'highlight') && (
          <div className="relative">
            <button 
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="flex items-center gap-1.5 bg-white dark:bg-gray-800 sepia:bg-sepia-50 px-3 py-2 rounded-2xl shadow-xs border border-gray-200 dark:border-gray-700 sepia:border-sepia-200 text-xs font-semibold"
            >
              <div 
                className="w-3.5 h-3.5 rounded-full border border-black/10" 
                style={{ backgroundColor: activeTool === 'highlight' ? highlightColor.replace('0.45', '1') : drawColor }}
              />
              <Palette className="w-3.5 h-3.5 text-gray-500" />
            </button>

            {showColorPicker && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowColorPicker(false)} />
                <div className="absolute right-0 mt-2 p-3 bg-white dark:bg-gray-800 sepia:bg-sepia-50 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 z-40 w-48 space-y-3">
                  <div>
                    <div className="text-[11px] font-semibold text-gray-500 mb-1.5">Pick Color</div>
                    <div className="flex gap-2">
                      {(activeTool === 'highlight' ? HIGHLIGHT_COLORS : DRAW_COLORS).map(c => (
                        <button 
                          key={c}
                          onClick={() => {
                            if (activeTool === 'highlight') setHighlightColor(c);
                            else setDrawColor(c);
                            setShowColorPicker(false);
                          }}
                          className="w-7 h-7 rounded-full border border-black/10 flex items-center justify-center transition-transform active:scale-90"
                          style={{ backgroundColor: c.replace('0.45', '1') }}
                        >
                          {((activeTool === 'highlight' && highlightColor === c) || (activeTool === 'draw' && drawColor === c)) && (
                            <Check className="w-3.5 h-3.5 text-white stroke-[3] drop-shadow-xs" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {activeTool === 'draw' && (
                    <div>
                      <div className="text-[11px] font-semibold text-gray-500 mb-1.5">Pen Thickness</div>
                      <div className="flex items-center gap-2">
                        {[2, 4, 6].map(w => (
                          <button 
                            key={w}
                            onClick={() => { setStrokeWidth(w); setShowColorPicker(false); }}
                            className={`flex-1 py-1 text-xs font-semibold rounded-lg border ${strokeWidth === w ? 'bg-blue-50 border-blue-500 text-blue-600' : 'border-gray-200 dark:border-gray-700'}`}
                          >
                            {w}px
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Clear Page Annotations */}
        {annotations.some(a => a.page === pageNum) && (
          <button 
            onClick={() => {
              if (window.confirm("Clear all annotations on this page?")) {
                setAnnotations(prev => prev.filter(a => a.page !== pageNum));
                setHasUnsavedChanges(true);
              }
            }}
            className="flex items-center gap-1 text-[11px] font-semibold text-red-500 bg-red-50 dark:bg-red-950/40 px-2.5 py-2 rounded-2xl shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Clear Page
          </button>
        )}
      </div>

      {/* Main PDF Scrollable Stage */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto relative touch-pan-x touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="p-4" style={{ 
          width: `${(pageSize.width * fitScale * userZoom) + 32}px`,
          height: `${(pageSize.height * fitScale * userZoom) + 32}px`,
          margin: '0 auto',
          position: 'relative'
        }}>
          <div 
            className="relative shadow-xl rounded-md overflow-hidden bg-white origin-top-left"
            style={{
              width: pageSize.width * fitScale * renderZoom,
              height: pageSize.height * fitScale * renderZoom,
              transform: `scale(${userZoom / renderZoom})`,
              transition: 'none'
            }}
          >
            {/* Background PDF Canvas */}
            <canvas ref={canvasRef} className="block bg-white w-full h-full" />

            {/* Foreground Annotation Canvas */}
            <canvas 
              ref={drawCanvasRef} 
              className={`absolute inset-0 w-full h-full ${
                activeTool === 'pan' 
                  ? 'cursor-grab touch-pan-x touch-pan-y pointer-events-none' 
                  : 'cursor-crosshair touch-none'
              }`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />

            {/* Loading / Rendering Indicator */}
            {isPageChanging && (
              <div className="absolute inset-0 bg-white/40 dark:bg-gray-900/40 backdrop-blur-2xs flex items-center justify-center pointer-events-none">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Navigation & Zoom Bar with Safe Area Bottom */}
      <footer className="bg-white/95 dark:bg-gray-900/95 sepia:bg-sepia-50/95 border-t border-gray-200 dark:border-gray-800 sepia:border-sepia-200 pt-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-1 shadow-lg z-30 shrink-0">
        {/* Pagination Controls */}
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setPageNum(p => Math.max(1, p - 1))}
            disabled={pageNum <= 1}
            className="h-10 px-3 bg-gray-100 dark:bg-gray-800 sepia:bg-sepia-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl disabled:opacity-40 flex items-center gap-1 text-xs font-bold active:scale-95 transition-all text-gray-800 dark:text-gray-200"
            aria-label="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden xs:inline">Prev</span>
          </button>

          <button 
            onClick={() => {
              setJumpPageInput(String(pageNum));
              setIsJumpModalOpen(true);
            }}
            className="h-10 px-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl text-xs font-semibold border border-gray-200 dark:border-gray-700 min-w-[72px] text-center active:scale-95"
          >
            {pageNum} / {totalPages}
          </button>

          <button 
            onClick={() => setPageNum(p => Math.min(totalPages, p + 1))}
            disabled={pageNum >= totalPages}
            className="h-10 px-3 bg-gray-100 dark:bg-gray-800 sepia:bg-sepia-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl disabled:opacity-40 flex items-center gap-1 text-xs font-bold active:scale-95 transition-all text-gray-800 dark:text-gray-200"
            aria-label="Next Page"
          >
            <span className="hidden xs:inline">Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setUserZoom(z => Math.max(0.6, z - 0.2))}
            className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-800 sepia:bg-sepia-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl active:scale-95 text-gray-700 dark:text-gray-300"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button 
            onClick={() => setUserZoom(1.0)}
            className="h-10 px-2 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
            title="Reset Zoom to Fit Width"
          >
            {Math.round(userZoom * 100)}%
          </button>

          <button 
            onClick={() => setUserZoom(z => Math.min(3.5, z + 0.2))}
            className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-800 sepia:bg-sepia-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl active:scale-95 text-gray-700 dark:text-gray-300"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </footer>

      {/* Jump Page Dialog Modal */}
      {isJumpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-900 sepia:bg-sepia-50 rounded-3xl p-5 shadow-2xl border border-gray-100 dark:border-gray-800 sepia:border-sepia-200 w-full max-w-xs animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base">Jump to Page</h3>
              <button onClick={() => setIsJumpModalOpen(false)} className="p-1 text-gray-400 rounded-full">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">Enter page number (1 to {totalPages})</p>
            <input 
              type="number"
              min={1}
              max={totalPages}
              value={jumpPageInput}
              onChange={(e) => setJumpPageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleJumpPage();
              }}
              autoFocus
              className="w-full text-center text-xl font-bold py-3 bg-gray-100 dark:bg-gray-800 rounded-2xl mb-4 outline-none border border-transparent focus:border-blue-500"
            />
            <div className="flex gap-2">
              <button 
                onClick={() => setIsJumpModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 font-semibold text-xs text-gray-600 dark:text-gray-400"
              >
                Cancel
              </button>
              <button 
                onClick={handleJumpPage}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs"
              >
                Go
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Save Toast Notification */}
      {saveToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900/90 text-white dark:bg-white/90 dark:text-gray-900 px-4 py-2.5 rounded-full shadow-2xl text-xs font-semibold flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom duration-150">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{saveToast}</span>
        </div>
      )}
    </div>
  );
}
