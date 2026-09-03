import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { 
  ArrowLeft, ZoomIn, ZoomOut, Save, Download, Highlighter, PenTool, 
  Eraser, Hand, Palette, RotateCcw, Check, ChevronLeft, ChevronRight, X, Search, Square, Circle, MousePointer2,
  ChevronUp, ChevronDown, Loader2
} from 'lucide-react';
import { LocalDocument } from '../types';
import { useToast } from './Toast';
import { useSettings } from './SettingsContext';
import { PDFDocument, rgb, BlendMode } from 'pdf-lib';
import { saveLocalDocument } from '../lib/idb';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor, registerPlugin } from '@capacitor/core';

const JetpackPdf = registerPlugin<any>('JetpackPdf');

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PdfViewerProps {
  doc: LocalDocument;
  onClose: () => void;
}

type Tool = 'pan' | 'highlight' | 'draw' | 'erase' | 'arrow' | 'rectangle' | 'circle';

interface AnnotationPoint {
  x: number; // Normalized to 0..1 relative to page width
  y: number; // Normalized to 0..1 relative to page height
}

interface Annotation {
  id: string;
  type: 'highlight' | 'draw' | 'arrow' | 'rectangle' | 'circle';
  page: number;
  points: AnnotationPoint[];
  color: string;
  strokeWidth: number;
}

interface SearchMatch {
  id: string;
  pageNum: number;
  textSnippet: string;
  rects: { x: number; y: number; width: number; height: number }[];
}

const HIGHLIGHT_COLORS = [
  'rgba(250, 204, 21, 0.45)', // yellow
  'rgba(74, 222, 128, 0.45)',  // green
  'rgba(96, 165, 250, 0.45)',  // blue
  'rgba(244, 114, 182, 0.45)', // pink
  'rgba(192, 132, 252, 0.45)', // purple
  'rgba(248, 113, 113, 0.45)', // red
  'rgba(251, 146, 60, 0.45)',  // orange
  'rgba(45, 212, 191, 0.45)',  // teal
  'rgba(163, 230, 53, 0.45)',  // lime
  'rgba(148, 163, 184, 0.45)', // slate
];

const DRAW_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#111827', // dark
  '#6b7280', // gray
  '#ffffff', // white
];

export function PdfViewer({ doc, onClose }: PdfViewerProps) {
  const { showToast } = useToast();
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({ width: 595, height: 842 });
  
  // Settings
  const { settings } = useSettings();

  // Hardware-Accelerated Pan & Zoom State
  const [userZoom, setUserZoom] = useState(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const zoomRef = useRef(1.0);
  const panRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Gesture tracking refs
  const isPinchingRef = useRef(false);
  const isPanningRef = useRef(false);
  const pinchStartDistRef = useRef(1);
  const pinchStartZoomRef = useRef(1.0);
  const pinchStartPanRef = useRef({ x: 0, y: 0 });
  const pinchContentFocusRef = useRef({ x: 0, y: 0 });
  const panStartTouchRef = useRef({ x: 0, y: 0 });
  const panStartOffsetRef = useRef({ x: 0, y: 0 });
  const isMouseDownRef = useRef(false);
  const mouseStartRef = useRef({ x: 0, y: 0 });
  const mousePanStartRef = useRef({ x: 0, y: 0 });
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);

  const renderZoom = 2.0; // High-res PDF rendering multiplier for retina clarity
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
  const currentPathRef = useRef<AnnotationPoint[]>([]);
  const isDrawingRef = useRef(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [isJumpModalOpen, setIsJumpModalOpen] = useState(false);
  const [jumpPageInput, setJumpPageInput] = useState('1');

  // In-App Document Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchMatch[]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // DOM Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);

  // Smooth ease-out animation helper
  const animateTo = useCallback((targetZoom: number, targetPan: { x: number; y: number }, customDuration?: number) => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    const startZoom = zoomRef.current;
    const startPan = { ...panRef.current };
    const duration = customDuration !== undefined ? customDuration : (settings.animationDuration ?? 200);

    if (duration <= 10) {
      zoomRef.current = targetZoom;
      panRef.current = { ...targetPan };
      setUserZoom(targetZoom);
      setPan({ ...targetPan });
      if (stageRef.current) {
        stageRef.current.style.transform = `translate3d(${targetPan.x}px, ${targetPan.y}px, 0) scale(${targetZoom})`;
      }
      return;
    }

    const startTime = performance.now();

    const step = (now: number) => {
      let progress = (now - startTime) / duration;
      if (progress > 1) progress = 1;
      // Cubic ease-out
      const ease = 1 - Math.pow(1 - progress, 3);

      const curZoom = startZoom + (targetZoom - startZoom) * ease;
      const curPanX = startPan.x + (targetPan.x - startPan.x) * ease;
      const curPanY = startPan.y + (targetPan.y - startPan.y) * ease;

      zoomRef.current = curZoom;
      panRef.current = { x: curPanX, y: curPanY };

      if (stageRef.current) {
        stageRef.current.style.transform = `translate3d(${curPanX}px, ${curPanY}px, 0) scale(${curZoom})`;
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        setUserZoom(targetZoom);
        setPan({ ...targetPan });
        animFrameRef.current = null;
      }
    };

    animFrameRef.current = requestAnimationFrame(step);
  }, [settings.animationDuration]);

  // Center page helper
  const centerPage = useCallback((fit: number, pSize: { width: number; height: number }, resetZoom = false) => {
    if (!containerRef.current || pSize.width <= 0) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const targetZoom = resetZoom ? 1.0 : zoomRef.current;
    const pw = pSize.width * fit * targetZoom;
    const ph = pSize.height * fit * targetZoom;

    const initX = Math.max(0, (cw - pw) / 2);
    const initY = Math.max(16, (ch - ph) / 2);

    panRef.current = { x: initX, y: initY };
    zoomRef.current = targetZoom;
    setPan({ x: initX, y: initY });
    setUserZoom(targetZoom);

    if (stageRef.current) {
      stageRef.current.style.transform = `translate3d(${initX}px, ${initY}px, 0) scale(${targetZoom})`;
    }
  }, []);

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
        showToast("Failed to load PDF document.", "error");
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
    // Leave safe horizontal margins
    const availableWidth = Math.max(containerWidth - 24, 280);
    return availableWidth / pageWidth;
  }, []);

  // Update scale on window/container resize
  useEffect(() => {
    const handleResize = () => {
      if (pageSize.width > 0) {
        const fit = calculateFitScale(pageSize.width);
        setFitScale(fit);
        centerPage(fit, pageSize);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pageSize, calculateFitScale, centerPage]);

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
        const newPageSize = { width: baseViewport.width, height: baseViewport.height };
        setPageSize(newPageSize);

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

        // High-res pixel buffers
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        drawCanvas.width = Math.floor(viewport.width);
        drawCanvas.height = Math.floor(viewport.height);

        canvas.style.width = '100%';
        canvas.style.height = '100%';
        drawCanvas.style.width = '100%';
        drawCanvas.style.height = '100%';

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;
        if (isCancelled) return;

        redrawAnnotations(viewport.width, viewport.height);
        setIsPageChanging(false);

        // If page changed, center view smoothly
        if (lastRenderedPageRef.current !== 0 && lastRenderedPageRef.current !== pageNum) {
          centerPage(calculatedFit, newPageSize);
        } else if (lastRenderedPageRef.current === 0) {
          centerPage(calculatedFit, newPageSize, true);
        }
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
  }, [pdf, pageNum, renderZoom, calculateFitScale, centerPage]);

  // 4. Redraw Annotations on Overlay Canvas
  const redrawAnnotations = useCallback((canvasWidth?: number, canvasHeight?: number) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvasWidth || canvas.width;
    const height = canvasHeight || canvas.height;

    ctx.clearRect(0, 0, width, height);

    const drawShape = (ctx: CanvasRenderingContext2D, type: string, points: AnnotationPoint[], color: string, sw: number) => {
      if (points.length < 2) return;
      ctx.save();
      const p1 = points[0];
      const p2 = points[points.length - 1];

      if (type === 'highlight' || type === 'draw') {
        ctx.beginPath();
        ctx.moveTo(p1.x * width, p1.y * height);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x * width, points[i].y * height);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(type === 'highlight' ? 16 : 2, sw * (width / 595));
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = type === 'highlight' ? 'multiply' : 'source-over';
        ctx.stroke();
      } else if (type === 'arrow') {
        const headlen = 15 * (width / 595); // length of head in pixels
        const dx = (p2.x - p1.x) * width;
        const dy = (p2.y - p1.y) * height;
        const angle = Math.atan2(dy, dx);
        ctx.beginPath();
        ctx.moveTo(p1.x * width, p1.y * height);
        ctx.lineTo(p2.x * width, p2.y * height);
        ctx.lineTo(p2.x * width - headlen * Math.cos(angle - Math.PI / 6), p2.y * height - headlen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(p2.x * width, p2.y * height);
        ctx.lineTo(p2.x * width - headlen * Math.cos(angle + Math.PI / 6), p2.y * height - headlen * Math.sin(angle + Math.PI / 6));
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2, sw * (width / 595));
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      } else if (type === 'rectangle') {
        ctx.beginPath();
        ctx.rect(p1.x * width, p1.y * height, (p2.x - p1.x) * width, (p2.y - p1.y) * height);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2, sw * (width / 595));
        ctx.stroke();
      } else if (type === 'circle') {
        ctx.beginPath();
        const rx = Math.abs(p2.x - p1.x) * width / 2;
        const ry = Math.abs(p2.y - p1.y) * height / 2;
        const cx = Math.min(p1.x, p2.x) * width + rx;
        const cy = Math.min(p1.y, p2.y) * height + ry;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2, sw * (width / 595));
        ctx.stroke();
      }
      ctx.restore();
    };

    const pageAnns = annotations.filter(a => a.page === pageNum);
    pageAnns.forEach(ann => {
      drawShape(ctx, ann.type, ann.points, ann.color, ann.strokeWidth || (ann.type === 'highlight' ? 20 : 3));
    });

    const currentPath = currentPathRef.current || [];
    if (currentPath.length > 1) {
      drawShape(ctx, activeTool, currentPath, activeTool === 'highlight' ? highlightColor : drawColor, activeTool === 'highlight' ? 20 : strokeWidth);
    }
  }, [annotations, pageNum, activeTool, highlightColor, drawColor, strokeWidth]);

  useEffect(() => {
    redrawAnnotations();
  }, [annotations, redrawAnnotations]);

  // 5. Pointer / Drawing Handlers
  const getNormalizedPoint = (e: React.PointerEvent<HTMLCanvasElement>): AnnotationPoint | null => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
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

    isDrawingRef.current = true;
    setIsDrawing(true);
    currentPathRef.current = [pt];
    redrawAnnotations();
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const pt = getNormalizedPoint(e);
    if (!pt) return;
    currentPathRef.current.push(pt);
    redrawAnnotations();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setIsDrawing(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const path = currentPathRef.current;
    if (path.length > 1) {
      const newAnn: Annotation = {
        id: crypto.randomUUID(),
        type: activeTool as any,
        page: pageNum,
        points: [...path],
        color: activeTool === 'highlight' ? highlightColor : drawColor,
        strokeWidth: activeTool === 'highlight' ? 20 : strokeWidth
      };
      setAnnotations(prev => [...prev, newAnn]);
      setHasUnsavedChanges(true);
    }
    currentPathRef.current = [];
    redrawAnnotations();
  };

  // Clamp viewport bounds smoothly
  const clampPanBounds = useCallback(() => {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const pw = pageSize.width * fitScale * zoomRef.current;
    const ph = pageSize.height * fitScale * zoomRef.current;

    const curX = panRef.current.x;
    const curY = panRef.current.y;
    let clampedX = curX;
    let clampedY = curY;

    if (pw <= cw) {
      clampedX = (cw - pw) / 2;
    } else {
      const minX = cw - pw - 48;
      const maxX = 48;
      clampedX = Math.min(maxX, Math.max(minX, curX));
    }

    if (ph <= ch) {
      clampedY = Math.max(16, (ch - ph) / 2);
    } else {
      const minY = ch - ph - 48;
      const maxY = 48;
      clampedY = Math.min(maxY, Math.max(minY, curY));
    }

    if (Math.abs(clampedX - curX) > 1 || Math.abs(clampedY - curY) > 1) {
      animateTo(zoomRef.current, { x: clampedX, y: clampedY }, 150);
    }
  }, [pageSize, fitScale, animateTo]);

  // 6. Touch Gestures (Pinch to Zoom, Panning & Double Tap)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch gesture
      isPinchingRef.current = true;
      isPanningRef.current = false;

      // Cancel ongoing stroke if user placed second finger
      if (isDrawingRef.current) {
        isDrawingRef.current = false;
        setIsDrawing(false);
        currentPathRef.current = [];
        redrawAnnotations();
      }

      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };

      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      pinchStartDistRef.current = Math.max(dist, 1);
      pinchStartZoomRef.current = zoomRef.current;
      pinchStartPanRef.current = { ...panRef.current };

      const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const midY = (t1.clientY + t2.clientY) / 2 - rect.top;

      // Focal point in content coordinates
      pinchContentFocusRef.current = {
        x: (midX - panRef.current.x) / zoomRef.current,
        y: (midY - panRef.current.y) / zoomRef.current,
      };
    } else if (e.touches.length === 1 && activeTool === 'pan') {
      // 1-finger pan in Pan tool
      isPanningRef.current = true;
      const t = e.touches[0];
      panStartTouchRef.current = { x: t.clientX, y: t.clientY };
      panStartOffsetRef.current = { ...panRef.current };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && isPinchingRef.current) {
      if (e.cancelable) e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };

      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const distRatio = dist / pinchStartDistRef.current;

      const sensitivity = settings.zoomSensitivity || 1.0;
      const effectiveRatio = 1 + (distRatio - 1) * sensitivity;
      const newZoom = Math.min(Math.max(0.5, pinchStartZoomRef.current * effectiveRatio), 5.0);

      const curMidX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const curMidY = (t1.clientY + t2.clientY) / 2 - rect.top;

      const focus = pinchContentFocusRef.current;
      const newPanX = curMidX - focus.x * newZoom;
      const newPanY = curMidY - focus.y * newZoom;

      panRef.current = { x: newPanX, y: newPanY };
      zoomRef.current = newZoom;

      if (stageRef.current) {
        stageRef.current.style.transform = `translate3d(${newPanX}px, ${newPanY}px, 0) scale(${newZoom})`;
      }
    } else if (e.touches.length === 1 && isPanningRef.current && activeTool === 'pan') {
      if (e.cancelable) e.preventDefault();
      const t = e.touches[0];
      const speed = settings.panningSpeed || 1.0;
      const dx = (t.clientX - panStartTouchRef.current.x) * speed;
      const dy = (t.clientY - panStartTouchRef.current.y) * speed;

      const newPanX = panStartOffsetRef.current.x + dx;
      const newPanY = panStartOffsetRef.current.y + dy;

      panRef.current = { x: newPanX, y: newPanY };

      if (stageRef.current) {
        stageRef.current.style.transform = `translate3d(${newPanX}px, ${newPanY}px, 0) scale(${zoomRef.current})`;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isPinchingRef.current && e.touches.length < 2) {
      isPinchingRef.current = false;
      setUserZoom(zoomRef.current);
      setPan({ ...panRef.current });
      clampPanBounds();
    }

    if (isPanningRef.current && e.touches.length === 0) {
      isPanningRef.current = false;
      setPan({ ...panRef.current });
      clampPanBounds();
    }

    // Double tap handling
    if (e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      const now = Date.now();
      const last = lastTapRef.current;
      const doubleTapSpeed = settings.doubleTapSpeed || 300;

      if (last && now - last.time < doubleTapSpeed && Math.hypot(touch.clientX - last.x, touch.clientY - last.y) < 32) {
        const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0, width: 320, height: 480 };
        const tapX = touch.clientX - rect.left;
        const tapY = touch.clientY - rect.top;

        if (zoomRef.current > 1.25) {
          // Reset to 1.0 centered
          const pw = pageSize.width * fitScale;
          const ph = pageSize.height * fitScale;
          const targetX = Math.max(0, (rect.width - pw) / 2);
          const targetY = Math.max(16, (rect.height - ph) / 2);
          animateTo(1.0, { x: targetX, y: targetY });
        } else {
          // Zoom to 2.2x centered on tap
          const targetZoom = 2.2;
          const focusX = (tapX - panRef.current.x) / zoomRef.current;
          const focusY = (tapY - panRef.current.y) / zoomRef.current;
          const targetPanX = tapX - focusX * targetZoom;
          const targetPanY = tapY - focusY * targetZoom;
          animateTo(targetZoom, { x: targetPanX, y: targetPanY });
        }
        lastTapRef.current = null;
        return;
      }
      lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
    }
  };

  // Desktop Mouse / Trackpad Handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };

    if (e.ctrlKey) {
      // Pinch or Ctrl+Wheel Zoom
      const sensitivity = settings.zoomSensitivity || 1.0;
      const zoomFactor = 1 - e.deltaY * 0.008 * sensitivity;
      const newZoom = Math.min(Math.max(0.5, zoomRef.current * zoomFactor), 5.0);

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const focusX = (mouseX - panRef.current.x) / zoomRef.current;
      const focusY = (mouseY - panRef.current.y) / zoomRef.current;

      const newPanX = mouseX - focusX * newZoom;
      const newPanY = mouseY - focusY * newZoom;

      zoomRef.current = newZoom;
      panRef.current = { x: newPanX, y: newPanY };
      setUserZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });

      if (stageRef.current) {
        stageRef.current.style.transform = `translate3d(${newPanX}px, ${newPanY}px, 0) scale(${newZoom})`;
      }
    } else {
      // Normal 2-finger scroll / mouse wheel
      const speed = settings.panningSpeed || 1.0;
      const newPanX = panRef.current.x - e.deltaX * speed;
      const newPanY = panRef.current.y - e.deltaY * speed;

      panRef.current = { x: newPanX, y: newPanY };
      setPan({ x: newPanX, y: newPanY });

      if (stageRef.current) {
        stageRef.current.style.transform = `translate3d(${newPanX}px, ${newPanY}px, 0) scale(${zoomRef.current})`;
      }
    }
  };

  const handleContainerPointerDown = (e: React.PointerEvent) => {
    if (activeTool !== 'pan' || e.pointerType === 'touch') return;
    isMouseDownRef.current = true;
    mouseStartRef.current = { x: e.clientX, y: e.clientY };
    mousePanStartRef.current = { ...panRef.current };
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch {}
  };

  const handleContainerPointerMove = (e: React.PointerEvent) => {
    if (!isMouseDownRef.current || activeTool !== 'pan' || e.pointerType === 'touch') return;
    const speed = settings.panningSpeed || 1.0;
    const dx = (e.clientX - mouseStartRef.current.x) * speed;
    const dy = (e.clientY - mouseStartRef.current.y) * speed;
    const newPan = {
      x: mousePanStartRef.current.x + dx,
      y: mousePanStartRef.current.y + dy,
    };
    panRef.current = newPan;
    if (stageRef.current) {
      stageRef.current.style.transform = `translate3d(${newPan.x}px, ${newPan.y}px, 0) scale(${zoomRef.current})`;
    }
  };

  const handleContainerPointerUp = (e: React.PointerEvent) => {
    if (!isMouseDownRef.current || e.pointerType === 'touch') return;
    isMouseDownRef.current = false;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    setPan({ ...panRef.current });
    clampPanBounds();
  };

  // Zoom Button Controls
  const handleZoomIn = () => {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const targetZoom = Math.min(5.0, zoomRef.current * 1.3);
    const midX = cw / 2;
    const midY = ch / 2;
    const focusX = (midX - panRef.current.x) / zoomRef.current;
    const focusY = (midY - panRef.current.y) / zoomRef.current;
    const targetPanX = midX - focusX * targetZoom;
    const targetPanY = midY - focusY * targetZoom;
    animateTo(targetZoom, { x: targetPanX, y: targetPanY });
  };

  const handleZoomOut = () => {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const targetZoom = Math.max(0.5, zoomRef.current / 1.3);
    const midX = cw / 2;
    const midY = ch / 2;
    const focusX = (midX - panRef.current.x) / zoomRef.current;
    const focusY = (midY - panRef.current.y) / zoomRef.current;
    const targetPanX = midX - focusX * targetZoom;
    const targetPanY = midY - focusY * targetZoom;
    animateTo(targetZoom, { x: targetPanX, y: targetPanY });
  };

  const handleResetZoom = () => {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const pw = pageSize.width * fitScale;
    const ph = pageSize.height * fitScale;
    const targetX = Math.max(0, (cw - pw) / 2);
    const targetY = Math.max(16, (ch - ph) / 2);
    animateTo(1.0, { x: targetX, y: targetY });
  };

  // In-App PDF Document Search Engine
  const performSearch = useCallback(async (query: string) => {
    if (!pdf || !query.trim()) {
      setSearchResults([]);
      setActiveMatchIndex(-1);
      return;
    }
    const cleanQ = query.trim().toLowerCase();
    setIsSearching(true);
    const matches: SearchMatch[] = [];

    try {
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.0 });
        const pageWidth = viewport.width;
        const pageHeight = viewport.height;

        for (const item of textContent.items as any[]) {
          if (!item.str) continue;
          const str = item.str;
          const lowerStr = str.toLowerCase();
          let startIndex = 0;

          while ((startIndex = lowerStr.indexOf(cleanQ, startIndex)) !== -1) {
            const tx = item.transform;
            const x0 = tx[4];
            const y0 = tx[5];
            const itemWidth = item.width || 20;
            const itemHeight = item.height || Math.abs(tx[3]) || 12;

            const [vx1, vy1] = viewport.convertToViewportPoint(x0, y0);
            const [vx2, vy2] = viewport.convertToViewportPoint(x0 + itemWidth, y0 + itemHeight);

            const x = Math.min(vx1, vx2) / pageWidth;
            const y = Math.min(vy1, vy2) / pageHeight;
            const width = Math.max(0.015, Math.abs(vx1 - vx2) / pageWidth);
            const height = Math.max(0.012, Math.abs(vy1 - vy2) / pageHeight);

            matches.push({
              id: `${p}-${matches.length}`,
              pageNum: p,
              textSnippet: str.slice(Math.max(0, startIndex - 10), Math.min(str.length, startIndex + cleanQ.length + 10)),
              rects: [{ x, y, width, height }]
            });

            startIndex += cleanQ.length;
          }
        }
      }

      setSearchResults(matches);
      if (matches.length > 0) {
        const firstOnOrAfter = matches.findIndex(m => m.pageNum >= pageNum);
        const idx = firstOnOrAfter !== -1 ? firstOnOrAfter : 0;
        setActiveMatchIndex(idx);
        if (matches[idx].pageNum !== pageNum) {
          setPageNum(matches[idx].pageNum);
        }
      } else {
        setActiveMatchIndex(-1);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  }, [pdf, pageNum]);

  const handleNextMatch = () => {
    if (searchResults.length === 0) return;
    const nextIdx = (activeMatchIndex + 1) % searchResults.length;
    setActiveMatchIndex(nextIdx);
    const match = searchResults[nextIdx];
    if (match.pageNum !== pageNum) {
      setPageNum(match.pageNum);
    }
  };

  const handlePrevMatch = () => {
    if (searchResults.length === 0) return;
    const prevIdx = (activeMatchIndex - 1 + searchResults.length) % searchResults.length;
    setActiveMatchIndex(prevIdx);
    const match = searchResults[prevIdx];
    if (match.pageNum !== pageNum) {
      setPageNum(match.pageNum);
    }
  };

  // Keyboard shortcuts for search and navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (e.key === 'Escape') {
        if (isSearchOpen) {
          setIsSearchOpen(false);
        } else if (showColorPicker) {
          setShowColorPicker(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, showColorPicker]);

  // Universal Color Parser for pdf-lib Export
  const parseColorToRgb = (colorStr: string, isHighlight: boolean) => {
    if (colorStr.startsWith('#')) {
      const hex = colorStr.replace('#', '');
      const num = parseInt(hex, 16);
      return {
        r: ((num >> 16) & 255) / 255,
        g: ((num >> 8) & 255) / 255,
        b: (num & 255) / 255,
        alpha: 1.0,
      };
    }
    const match = colorStr.match(/[\d.]+/g);
    if (match && match.length >= 3) {
      return {
        r: parseFloat(match[0]) / 255,
        g: parseFloat(match[1]) / 255,
        b: parseFloat(match[2]) / 255,
        alpha: match.length >= 4 ? parseFloat(match[3]) : (isHighlight ? 0.45 : 1.0),
      };
    }
    return { r: 0.9, g: 0.2, b: 0.2, alpha: isHighlight ? 0.45 : 1.0 };
  };

  // 7. Save Annotations to Local IndexedDB & PDF Bytes
  const handleSave = async () => {
    if (annotations.length === 0 && !hasUnsavedChanges) {
      showToast("No annotations to save.");
      return;
    }

    setIsSaving(true);
    try {
      const buf = currentPdfDataRef.current;
      let arrayBuffer: ArrayBuffer;
      if (buf instanceof ArrayBuffer) {
        arrayBuffer = buf.slice(0);
      } else {
        arrayBuffer = new Uint8Array(buf as any).buffer;
      }
      let pdfDoc;
      try {
        pdfDoc = await PDFDocument.load(new Uint8Array(arrayBuffer), { ignoreEncryption: true });
      } catch (err: any) {
        throw new Error("Failed to load PDF bytes: " + err.message);
      }

      for (const ann of annotations) {
        if (ann.page > pdfDoc.getPageCount()) continue;
        if (ann.points.length < 2) continue;
        const page = pdfDoc.getPage(ann.page - 1);
        const { width: pWidth, height: pHeight } = page.getSize();

        const { r, g, b, alpha } = parseColorToRgb(ann.color, ann.type === 'highlight');

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
        let pathData = '';
        if (ann.type === 'rectangle') {
            const p1 = ann.points[0];
            const p2 = ann.points[ann.points.length - 1];
            const v1 = toRawPoint(p1.x, p1.y);
            const v2 = toRawPoint(p2.x, p1.y);
            const v3 = toRawPoint(p2.x, p2.y);
            const v4 = toRawPoint(p1.x, p2.y);
            pathData = `M ${v1.x} ${v1.y} L ${v2.x} ${v2.y} L ${v3.x} ${v3.y} L ${v4.x} ${v4.y} Z`;
        } else if (ann.type === 'circle') {
            const points = [];
            for (let i = 0; i <= 32; i++) {
                const theta = (i / 32) * Math.PI * 2;
                const p1 = ann.points[0];
                const p2 = ann.points[ann.points.length - 1];
                const cx = (p1.x + p2.x) / 2;
                const cy = (p1.y + p2.y) / 2;
                const rx = Math.abs(p2.x - p1.x) / 2;
                const ry = Math.abs(p2.y - p1.y) / 2;
                const nx = cx + rx * Math.cos(theta);
                const ny = cy + ry * Math.sin(theta);
                points.push(toRawPoint(nx, ny));
            }
            pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        } else if (ann.type === 'arrow') {
             const p1 = ann.points[0];
             const p2 = ann.points[ann.points.length - 1];
             const dx = p2.x - p1.x;
             // account for page aspect ratio when calculating angle so arrow head isn't skewed!
             // but drawing happens in normalized space for the vector, then transformed.
             // Actually it's easier to just calculate the angle in normalized space * aspect ratio:
             const angle = Math.atan2((p2.y - p1.y) * pHeight, (p2.x - p1.x) * pWidth);
             const headlen = 15; // raw pixels
             
             const v1 = toRawPoint(p1.x, p1.y);
             const v2 = toRawPoint(p2.x, p2.y);
             
             // The arrow head must be computed in raw space to be perfectly unskewed
             const h1x = v2.x - headlen * Math.cos(angle - Math.PI / 6);
             const h1y = v2.y - headlen * Math.sin(angle - Math.PI / 6);
             const h2x = v2.x - headlen * Math.cos(angle + Math.PI / 6);
             const h2y = v2.y - headlen * Math.sin(angle + Math.PI / 6);
             
             pathData = `M ${v1.x} ${v1.y} L ${v2.x} ${v2.y} L ${h1x} ${h1y} M ${v2.x} ${v2.y} L ${h2x} ${h2y}`;
        } else {
             pathData = ann.points.map((p, i) => {
               const raw = toRawPoint(p.x, p.y);
               return `${i === 0 ? 'M' : 'L'} ${raw.x} ${raw.y}`;
             }).join(' ');
        }

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
        
        try {
          page.drawSvgPath(pathData, drawOpts as any);
        } catch (svgErr) {
          console.warn("Failed to draw SVG path natively, falling back to lines", svgErr);
          // Fallback: draw straight lines between points if SVG fails
          for (let i = 1; i < ann.points.length; i++) {
             const start = toRawPoint(ann.points[i-1].x, ann.points[i-1].y);
             const end = toRawPoint(ann.points[i].x, ann.points[i].y);
             page.drawLine({
               start: { x: start.x, y: pHeight - start.y },
               end: { x: end.x, y: pHeight - end.y },
               thickness: ann.type === 'highlight' ? Math.max(12, ann.strokeWidth) : Math.max(1.5, ann.strokeWidth),
               color: rgb(r, g, b),
               opacity: alpha
             });
          }
        }
      }

      let savedBytes;
      try {
        savedBytes = await pdfDoc.save(); 
      } catch (saveErr: any) {
        if (saveErr.message && saveErr.message.toLowerCase().includes('password')) {
            console.warn("Encrypted PDF detected on save, rebuilding PDF to strip encryption...");
            const newPdf = await PDFDocument.create();
            const copiedPages = await newPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
            copiedPages.forEach((page) => newPdf.addPage(page));
            savedBytes = await newPdf.save({ useObjectStreams: false });
        } else {
            console.warn("Standard save failed, trying without object streams", saveErr);
            savedBytes = await pdfDoc.save({ useObjectStreams: false });
        }
      }

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
      showToast("Error saving annotations: " + (e instanceof Error ? e.message : String(e)), "error");
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

          {/* Search Button */}
          <button 
            onClick={() => {
              setIsSearchOpen(prev => !prev);
              if (!isSearchOpen) {
                setTimeout(() => searchInputRef.current?.focus(), 80);
              }
              // Also notify native plugin if running in Capacitor
              if (JetpackPdf) {
                JetpackPdf.setTextSearchActive({ active: !isSearchOpen }).catch(() => {});
              }
            }}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-95 ${
              isSearchOpen 
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 font-bold' 
                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'
            }`}
            title="Search in PDF (Ctrl+F)"
          >
            <Search className="w-5 h-5" />
          </button>

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

      {/* In-Document Search Toolbar */}
      {isSearchOpen && (
        <div className="bg-white/95 dark:bg-gray-900/95 sepia:bg-sepia-50/95 border-b border-gray-200 dark:border-gray-800 px-3 py-2 flex items-center gap-2 shadow-xs z-25 backdrop-blur animate-in slide-in-from-top-2 duration-150 shrink-0">
          <div className="flex-1 flex items-center bg-gray-100 dark:bg-gray-800 rounded-xl px-2.5 py-1.5 gap-2 border border-gray-200 dark:border-gray-700 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Find in document..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                performSearch(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (e.shiftKey) handlePrevMatch();
                  else handleNextMatch();
                }
              }}
              className="w-full bg-transparent text-xs text-gray-900 dark:text-gray-100 outline-none placeholder-gray-400"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setActiveMatchIndex(-1);
                }}
                className="text-gray-400 hover:text-gray-600 p-0.5 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 text-xs text-gray-500 font-medium">
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            ) : searchQuery ? (
              <span className="text-[11px] px-1 font-semibold text-gray-600 dark:text-gray-300">
                {searchResults.length > 0 ? `${activeMatchIndex + 1} of ${searchResults.length}` : '0 results'}
              </span>
            ) : null}

            <button
              onClick={handlePrevMatch}
              disabled={searchResults.length === 0}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg disabled:opacity-30 active:scale-95 text-gray-700 dark:text-gray-300"
              title="Previous match (Shift+Enter)"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextMatch}
              disabled={searchResults.length === 0}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg disabled:opacity-30 active:scale-95 text-gray-700 dark:text-gray-300"
              title="Next match (Enter)"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery('');
                setSearchResults([]);
                setActiveMatchIndex(-1);
              }}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              title="Close search"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Action / Tool Selector Bar (Optimized for Mobile Touch) */}
      <div className="px-3 pt-2 pb-1.5 flex items-center justify-between gap-2 shrink-0 z-20 relative">
        {/* Tool Segmented Control with Horizontal Scroll for Small Screens */}
        <div className="flex-1 overflow-x-auto no-scrollbar py-0.5">
          <div className="inline-flex items-center bg-white dark:bg-gray-800 sepia:bg-sepia-50 p-1 rounded-2xl shadow-xs border border-gray-200 dark:border-gray-700 sepia:border-sepia-200 gap-0.5">
            <button 
              onClick={() => setActiveTool('pan')} 
              className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
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
              className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
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
              className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                activeTool === 'draw' 
                  ? 'bg-red-500 text-white shadow-xs' 
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <PenTool className="w-4 h-4" />
              <span className="hidden sm:inline">Draw</span>
            </button>
            
            <button 
              onClick={() => setActiveTool('arrow')} 
              className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                activeTool === 'arrow' 
                  ? 'bg-purple-500 text-white shadow-xs' 
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <MousePointer2 className="w-4 h-4" />
              <span className="hidden sm:inline">Arrow</span>
            </button>

            <button 
              onClick={() => setActiveTool('rectangle')} 
              className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                activeTool === 'rectangle' 
                  ? 'bg-emerald-500 text-white shadow-xs' 
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Square className="w-4 h-4" />
              <span className="hidden sm:inline">Rect</span>
            </button>

            <button 
              onClick={() => setActiveTool('circle')} 
              className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                activeTool === 'circle' 
                  ? 'bg-pink-500 text-white shadow-xs' 
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Circle className="w-4 h-4" />
              <span className="hidden sm:inline">Circle</span>
            </button>

            <button 
              onClick={() => setActiveTool('erase')} 
              className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                activeTool === 'erase' 
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-xs' 
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Eraser className="w-4 h-4" />
              <span className="hidden sm:inline">Eraser</span>
            </button>
          </div>
        </div>

        {/* Right side controls: Color / Options Picker & Clear Page */}
        <div className="flex items-center gap-1.5 shrink-0">
          {(activeTool !== 'pan' && activeTool !== 'erase') && (
            <div className="relative">
              <button 
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="flex items-center gap-1.5 bg-white dark:bg-gray-800 sepia:bg-sepia-50 px-2.5 py-2 rounded-2xl shadow-xs border border-gray-200 dark:border-gray-700 sepia:border-sepia-200 text-xs font-semibold active:scale-95 transition-all"
                title="Choose Color & Stroke Width"
              >
                <div 
                  className="w-4 h-4 rounded-full border border-black/20 shadow-2xs shrink-0" 
                  style={{ backgroundColor: activeTool === 'highlight' ? highlightColor.replace('0.45', '1') : drawColor }}
                />
                <Palette className="w-3.5 h-3.5 text-gray-500" />
              </button>

              {showColorPicker && (
                <>
                  <div className="fixed inset-0 z-40 bg-black/10" onClick={() => setShowColorPicker(false)} />
                  <div 
                    className="absolute right-0 top-full mt-2 p-3.5 bg-white dark:bg-gray-800 sepia:bg-sepia-50 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 w-64 max-w-[calc(100vw-24px)] space-y-3.5 animate-in fade-in zoom-in-95 duration-100"
                    style={{ right: 0 }}
                  >
                    <div>
                      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                        {activeTool === 'highlight' ? 'Highlighter Colors' : 'Ink Colors'}
                      </div>
                      <div className="grid grid-cols-6 gap-2">
                        {(activeTool === 'highlight' ? HIGHLIGHT_COLORS : DRAW_COLORS).map(c => {
                          const isSelected = (activeTool === 'highlight' && highlightColor === c) || (activeTool !== 'highlight' && drawColor === c);
                          return (
                            <button 
                              key={c}
                              onClick={() => {
                                if (activeTool === 'highlight') setHighlightColor(c);
                                else setDrawColor(c);
                                setShowColorPicker(false);
                              }}
                              className={`w-7 h-7 rounded-full border flex items-center justify-center transition-transform active:scale-90 ${
                                isSelected ? 'ring-2 ring-blue-500 ring-offset-1 scale-110' : 'border-black/15 hover:scale-105'
                              }`}
                              style={{ backgroundColor: c.replace('0.45', '1') }}
                            >
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-white stroke-[3] drop-shadow-xs" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {(activeTool !== 'highlight' && activeTool !== 'erase' && activeTool !== 'pan') && (
                      <div className="pt-1 border-t border-gray-100 dark:border-gray-700">
                        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Stroke Thickness</div>
                        <div className="flex items-center gap-1.5">
                          {[2, 3, 5, 8].map(w => (
                            <button 
                              key={w}
                              onClick={() => { setStrokeWidth(w); setShowColorPicker(false); }}
                              className={`flex-1 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                                strokeWidth === w 
                                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-600 dark:text-blue-400 font-bold' 
                                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50'
                              }`}
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
              className="flex items-center gap-1 text-[11px] font-semibold text-red-500 bg-red-50 dark:bg-red-950/40 px-2.5 py-2 rounded-2xl shrink-0 active:scale-95"
              title="Clear annotations on page"
            >
              <RotateCcw className="w-3.5 h-3.5" /> 
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Main PDF Stage with Hardware-Accelerated Transforms (No Scrollbar/Margin Jiggle) */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-hidden relative touch-none select-none bg-gray-100 dark:bg-gray-950 sepia:bg-sepia-100"
        onWheel={handleWheel}
        onPointerDown={handleContainerPointerDown}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div 
          ref={stageRef}
          className="absolute origin-top-left will-change-transform"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${userZoom})`,
            width: pageSize.width * fitScale,
            height: pageSize.height * fitScale,
          }}
        >
          {/* Inner PDF Canvas Container */}
          <div 
            className="relative shadow-2xl rounded-xs overflow-hidden bg-white"
            style={{
              width: pageSize.width * fitScale,
              height: pageSize.height * fitScale,
            }}
          >
            {/* Background PDF Canvas */}
            <canvas ref={canvasRef} className="block bg-white w-full h-full" />

            {/* In-Document Search Highlight Rectangles */}
            {searchResults.map((match, idx) => {
              if (match.pageNum !== pageNum) return null;
              const isActive = idx === activeMatchIndex;
              return match.rects.map((r, rIdx) => (
                <div
                  key={`${match.id}-${rIdx}`}
                  className={`absolute pointer-events-none rounded-xs transition-all ${
                    isActive 
                      ? 'bg-orange-500/55 border-2 border-orange-600 ring-2 ring-orange-300 z-10 animate-pulse' 
                      : 'bg-yellow-400/40 border border-yellow-500/60 z-5'
                  }`}
                  style={{
                    left: `${r.x * 100}%`,
                    top: `${r.y * 100}%`,
                    width: `${r.width * 100}%`,
                    height: `${r.height * 100}%`,
                  }}
                />
              ));
            })}

            {/* Foreground Annotation Canvas */}
            <canvas 
              ref={drawCanvasRef} 
              className={`absolute inset-0 w-full h-full ${
                activeTool === 'pan' 
                  ? 'cursor-grab active:cursor-grabbing pointer-events-none' 
                  : 'cursor-crosshair'
              }`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />

            {/* Loading / Rendering Indicator */}
            {isPageChanging && (
              <div className="absolute inset-0 bg-white/40 dark:bg-gray-900/40 backdrop-blur-2xs flex items-center justify-center pointer-events-none z-20">
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
            className="h-10 px-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl text-xs font-semibold border border-gray-200 dark:border-gray-700 min-w-[72px] text-center active:scale-95 text-gray-800 dark:text-gray-200"
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

        {/* Zoom Controls with Hardware Accelerated Zoom Engine */}
        <div className="flex items-center gap-1">
          <button 
            onClick={handleZoomOut}
            className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-800 sepia:bg-sepia-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl active:scale-95 text-gray-700 dark:text-gray-300 transition-colors"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button 
            onClick={handleResetZoom}
            className="h-10 px-2 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl active:scale-95 transition-colors"
            title="Reset Zoom to 100%"
          >
            {Math.round(userZoom * 100)}%
          </button>

          <button 
            onClick={handleZoomIn}
            className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-800 sepia:bg-sepia-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl active:scale-95 text-gray-700 dark:text-gray-300 transition-colors"
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
      {false && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900/90 text-white dark:bg-white/90 dark:text-gray-900 px-4 py-2.5 rounded-full shadow-2xl text-xs font-semibold flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom duration-150">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>Saved</span>
        </div>
      )}
    </div>
  );
}
