const fs = require('fs');
let content = fs.readFileSync('src/components/PdfViewer.tsx', 'utf8');

const search = `  const handleTouchMove = (e: React.TouchEvent) => {
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
  };`;

const replace = `  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      const dist = Math.hypot(dx, dy);
      // Anchor ratio to the initial distance to prevent compounding float errors
      const ratio = dist / touchDistanceRef.current;
      
      const nextZoom = Math.min(Math.max(0.6, touchStartZoomRef.current * ratio), 4.0);
      
      const container = containerRef.current;
      if (container && nextZoom !== userZoom) {
        const rect = container.getBoundingClientRect();
        const pinchCenterX = (touch1.clientX + touch2.clientX) / 2 - rect.left;
        const pinchCenterY = (touch1.clientY + touch2.clientY) / 2 - rect.top;
        const contentX = pinchCenterX + container.scrollLeft;
        const contentY = pinchCenterY + container.scrollTop;
        const zoomRatio = nextZoom / userZoom;
        
        // Use requestAnimationFrame for smooth 60fps painting without blocking
        requestAnimationFrame(() => {
          setUserZoom(nextZoom);
          container.scrollLeft = contentX * zoomRatio - pinchCenterX;
          container.scrollTop = contentY * zoomRatio - pinchCenterY;
        });
      } else {
        requestAnimationFrame(() => {
          setUserZoom(nextZoom);
        });
      }
    }
  };`;

content = content.replace(search, replace);

fs.writeFileSync('src/components/PdfViewer.tsx', content);
