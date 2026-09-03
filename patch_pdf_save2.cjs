const fs = require('fs');
let code = fs.readFileSync('src/components/PdfViewer.tsx', 'utf-8');

const startStr = 'const handleSave = async () => {';
const endStr = 'setIsSaving(false);\n    }\n  };';

const startIdx = code.indexOf(startStr);
const endIdx = code.indexOf(endStr, startIdx) + endStr.length;

if (startIdx === -1 || endIdx === -1) {
  console.log("Could not find bounds", startIdx, endIdx);
  process.exit(1);
}

const newHandleSave = \`  const handleSave = async () => {
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
      } catch (loadErr: any) {
        throw new Error("Failed to load PDF for editing: " + loadErr.message);
      }

      for (const ann of annotations) {
        if (ann.page > pdfDoc.getPageCount()) continue;
        if (ann.points.length < 2) continue; 

        const page = pdfDoc.getPage(ann.page - 1);
        const { width: pWidth, height: pHeight } = page.getSize();
        
        // Grab internal rotation
        const rotation = page.getRotation().angle;

        let r = 0.9, g = 0.2, b = 0.2, alpha = 1.0;
        if (ann.type === 'highlight') {
          alpha = 0.45;
          if (ann.color.includes('250, 204, 21')) { r = 0.98; g = 0.8; b = 0.08; }
          else if (ann.color.includes('74, 222, 128')) { r = 0.29; g = 0.87; b = 0.5; }
          else if (ann.color.includes('244, 114, 182')) { r = 0.95; g = 0.44; b = 0.71; }
          else { r = 0.38; g = 0.65; b = 0.98; }
        } else {
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
          return \\\`\\\${i === 0 ? 'M' : 'L'} \\\${raw.x} \\\${raw.y}\\\`;
        }).join(' ');

        const drawOpts: any = {
          x: 0,
          y: pHeight,
          borderColor: rgb(r, g, b),
          borderWidth: ann.type === 'highlight' ? Math.max(12, ann.strokeWidth) : Math.max(1.5, ann.strokeWidth),
          borderOpacity: alpha,
        };
        
        if (ann.type === 'highlight') {
          drawOpts.blendMode = BlendMode.Multiply; 
        }
        
        try {
          page.drawSvgPath(pathData, drawOpts as any);
        } catch (drawErr) {
          console.warn("SVG Path failed, falling back to basic lines", drawErr);
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
        console.warn("Save failed, retrying without object streams", saveErr);
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

      const loadingTask = pdfjsLib.getDocument({ data: savedBytes.slice(0) });
      const loadedPdf = await loadingTask.promise;
      setPdf(loadedPdf);
    } catch (error: any) {
      console.error("Error saving annotations:", error);
      alert("Error saving annotations: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };\`;

code = code.substring(0, startIdx) + newHandleSave + code.substring(endIdx);
fs.writeFileSync('src/components/PdfViewer.tsx', code);
console.log("Patched successfully.");
