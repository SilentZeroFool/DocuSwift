cat << 'INNER_EOF' > replacement.txt
  const redrawActiveStroke = useCallback((canvasWidth?: number, canvasHeight?: number) => {
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
        const headlen = 15 * (width / 595);
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

    const currentPath = currentPathRef.current || [];
    if (currentPath.length > 1) {
      drawShape(ctx, activeTool, currentPath, activeTool === 'highlight' ? highlightColor : drawColor, activeTool === 'highlight' ? 20 : strokeWidth);
    }
  }, [activeTool, highlightColor, drawColor, strokeWidth]);
INNER_EOF
