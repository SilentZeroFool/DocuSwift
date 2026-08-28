const fs = require('fs');
let content = fs.readFileSync('src/components/PdfViewer.tsx', 'utf8');

// Add animateZoom function inside the component (we'll just replace the double tap logic)
const doubleTapSearch = `            if (userZoom > 1.1) {
               const targetZoom = 1.0;
               const zoomRatio = targetZoom / userZoom;
               
               flushSync(() => {
                 setUserZoom(targetZoom);
               });
               
               container.scrollLeft = contentX * zoomRatio - tapX;
               container.scrollTop = contentY * zoomRatio - tapY;
            } else {
               const targetZoom = 1.5;
               const zoomRatio = targetZoom / userZoom;
               
               flushSync(() => {
                 setUserZoom(targetZoom);
               });
               
               container.scrollLeft = contentX * zoomRatio - tapX;
               container.scrollTop = contentY * zoomRatio - tapY;
            }`;

const doubleTapReplace = `            const targetZoom = userZoom > 1.1 ? 1.0 : 1.5;
            const startZoom = userZoom;
            const startScrollLeft = container.scrollLeft;
            const startScrollTop = container.scrollTop;
            
            const targetScrollLeft = contentX * (targetZoom / startZoom) - tapX;
            const targetScrollTop = contentY * (targetZoom / startZoom) - tapY;
            
            setIsPinching(true); // Disable CSS transition
            
            const startTime = performance.now();
            const duration = 200;
            
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
            requestAnimationFrame(animate);`;

content = content.replace(doubleTapSearch, doubleTapReplace);

const pinchSearch = `                flushSync(() => {
          setUserZoom(nextZoom);
        });
        container.scrollLeft = contentX * zoomRatio - pinchCenterX;
        container.scrollTop = contentY * zoomRatio - pinchCenterY;`;

const pinchReplace = `        setUserZoom(nextZoom);
        // Using requestAnimationFrame to sync scroll with the render to prevent jumping
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollLeft = contentX * zoomRatio - pinchCenterX;
            containerRef.current.scrollTop = contentY * zoomRatio - pinchCenterY;
          }
        });`;

content = content.replace(pinchSearch, pinchReplace);

// We should also remove the CSS transition entirely since we are using JS tweening now.
const cssTransitionSearch = `              transform: \`scale(\${userZoom / renderZoom})\`,
              transition: isPinching ? 'none' : 'transform 0.2s ease-out'`;

const cssTransitionReplace = `              transform: \`scale(\${userZoom / renderZoom})\`,
              transition: 'none'`;

content = content.replace(cssTransitionSearch, cssTransitionReplace);


fs.writeFileSync('src/components/PdfViewer.tsx', content);
