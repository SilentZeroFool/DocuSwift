const fs = require('fs');
let content = fs.readFileSync('src/components/PdfViewer.tsx', 'utf8');

// 1. Add isPinching state
content = content.replace(
  'const [userZoom, setUserZoom] = useState(1.0); // CSS scale (instant)',
  'const [userZoom, setUserZoom] = useState(1.0); // CSS scale (instant)\n  const [isPinching, setIsPinching] = useState(false);'
);

// 2. Set isPinching in handleTouchStart
content = content.replace(
  `  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {`,
  `  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setIsPinching(true);`
);

// 3. Unset isPinching in handleTouchEnd
content = content.replace(
  `  const handleTouchEnd = (e: React.TouchEvent) => {
    touchDistanceRef.current = null;`,
  `  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      setIsPinching(false);
    }
    touchDistanceRef.current = null;`
);

// 4. Update style transform
content = content.replace(
  `              transform: \`scale(\${userZoom / renderZoom})\`,
              // The browser handles scale instantly for smooth pinch-to-zoom
            }}`,
  `              transform: \`scale(\${userZoom / renderZoom})\`,
              transition: isPinching ? 'none' : 'transform 0.2s ease-out'
            }}`
);

// 5. Update annotations map (fallback to Line if length is 2, etc, but SVG path is fine, let's keep drawSvgPath but ensure it works)
// Wait! "Annotations still does not save on android phone, but not only that, now it even fails to work on the website?"
// It fails because of `currentPdfDataRef.current = updatedDocument.data;`!
// What is updatedDocument.data? It's an ArrayBuffer.
// When we save again: `const pdfDoc = await PDFDocument.load(new Uint8Array(currentPdfDataRef.current.slice(0)), { ignoreEncryption: true });`
// `currentPdfDataRef.current.slice(0)` throws `TypeError: currentPdfDataRef.current.slice is not a function` because maybe it's not an ArrayBuffer, maybe it's a Buffer or Uint8Array?
// In `handleSave`: `data: savedBytes.buffer.slice(savedBytes.byteOffset, savedBytes.byteOffset + savedBytes.byteLength) as ArrayBuffer,`
// Let's change `currentPdfDataRef.current.slice(0)` to `currentPdfDataRef.current.slice(0)` ? ArrayBuffer has `slice`. 
// Let's just create a new Uint8Array from it!
content = content.replace(
  `const pdfDoc = await PDFDocument.load(new Uint8Array(currentPdfDataRef.current.slice(0)), { ignoreEncryption: true });`,
  `// Force it to an ArrayBuffer safely
      const buf = currentPdfDataRef.current;
      let arrayBuffer: ArrayBuffer;
      if (buf instanceof ArrayBuffer) {
        arrayBuffer = buf.slice(0);
      } else {
        // Fallback if it somehow became a typed array or buffer
        arrayBuffer = new Uint8Array(buf as any).buffer;
      }
      const pdfDoc = await PDFDocument.load(new Uint8Array(arrayBuffer), { ignoreEncryption: true });`
);

content = content.replace(
  `const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(currentPdfDataRef.current.slice(0)) });`,
  `const buf = currentPdfDataRef.current;
        let arrayBuffer: ArrayBuffer;
        if (buf instanceof ArrayBuffer) {
          arrayBuffer = buf.slice(0);
        } else {
          arrayBuffer = new Uint8Array(buf as any).buffer;
        }
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });`
);

fs.writeFileSync('src/components/PdfViewer.tsx', content);
