sed -i 's/const drawCanvas = drawCanvasRef.current;/const staticCanvas = staticCanvasRef.current;\n        const drawCanvas = drawCanvasRef.current;/g' src/components/PdfViewer.tsx
sed -i 's/if (!canvas || !drawCanvas) return;/if (!canvas || !drawCanvas || !staticCanvas) return;/g' src/components/PdfViewer.tsx
sed -i 's/drawCanvas.width = Math.floor(viewport.width);/staticCanvas.width = Math.floor(viewport.width);\n        drawCanvas.width = Math.floor(viewport.width);/g' src/components/PdfViewer.tsx
sed -i 's/drawCanvas.height = Math.floor(viewport.height);/staticCanvas.height = Math.floor(viewport.height);\n        drawCanvas.height = Math.floor(viewport.height);/g' src/components/PdfViewer.tsx
sed -i 's/drawCanvas.style.width = '"'"'100%'"'"';/staticCanvas.style.width = '"'"'100%'"'"';\n        drawCanvas.style.width = '"'"'100%'"'"';/g' src/components/PdfViewer.tsx
sed -i 's/drawCanvas.style.height = '"'"'100%'"'"';/staticCanvas.style.height = '"'"'100%'"'"';\n        drawCanvas.style.height = '"'"'100%'"'"';/g' src/components/PdfViewer.tsx
