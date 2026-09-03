const fs = require('fs');
let code = fs.readFileSync('src/components/PdfViewer.tsx', 'utf-8');

// Replace the handleSave completely to be safer
const oldHandleSave = `  const handleSave = async () => {
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

        const toRawPoint = (nx: number, ny: number): { x: number; y: number } => {
          switch (rotation) {
            case 90: return { x: ny * pWidth, y: (1 - nx) * pHeight };
            case 180: return { x: (1 - nx) * pWidth, y: (1 - ny) * pHeight };
            case 270: return { x: (1 - ny) * pWidth, y: nx * pHeight };
            default: return { x: nx * pWidth, y: ny * pHeight };
          }
        };

        const pathData = ann.points.map((p, i) => {
          const raw = toRawPoint(p.x, p.y);
          return \`\${i === 0 ? 'M' : 'L'} \${raw.x} \${raw.y}\`;
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
    } catch (error) {
      console.error("Error saving annotations:", error);
      alert("Error saving annotations: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsSaving(false);
    }
  };`;

const newHandleSave = `  const handleSave = async () => {
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
      
      let pdfDoc;
      try {
        pdfDoc = await PDFDocument.load(new Uint8Array(arrayBuffer), { ignoreEncryption: true });
      } catch (loadErr) {
        throw new Error("Failed to load PDF for editing: " + loadErr.message);
      }

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

        const toRawPoint = (nx: number, ny: number): { x: number; y: number } => {
          switch (rotation) {
            case 90: return { x: ny * pWidth, y: (1 - nx) * pHeight };
            case 180: return { x: (1 - nx) * pWidth, y: (1 - ny) * pHeight };
            case 270: return { x: (1 - ny) * pWidth, y: nx * pHeight };
            default: return { x: nx * pWidth, y: ny * pHeight };
          }
        };

        const pathData = ann.points.map((p, i) => {
          const raw = toRawPoint(p.x, p.y);
          return \`\${i === 0 ? 'M' : 'L'} \${raw.x} \${raw.y}\`;
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
          drawOpts.blendMode = BlendMode.Multiply; 
        }
        
        try {
          page.drawSvgPath(pathData, drawOpts as any);
        } catch (drawErr) {
          console.warn("Failed to draw SVG path natively, falling back to simple lines", drawErr);
          // Fallback: draw straight lines between points if SVG fails on this PDF
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
      } catch (saveErr) {
        console.warn("Standard save failed, trying without object streams", saveErr);
        savedBytes = await pdfDoc.save({ useObjectStreams: false });
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
    } catch (error) {
      console.error("Error saving annotations:", error);
      alert("Error saving annotations: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsSaving(false);
    }
  };`;

if (code.includes('const handleSave = async () => {')) {
  code = code.replace(oldHandleSave, newHandleSave);
  fs.writeFileSync('src/components/PdfViewer.tsx', code);
  console.log("Patched PdfViewer handleSave");
} else {
  console.log("Could not find handleSave block");
}
