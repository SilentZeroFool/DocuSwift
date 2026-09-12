cat << 'INNER_EOF' > replacement_pointer.txt
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const pt = getNormalizedPoint(e);
    if (!pt) return;
    
    const path = currentPathRef.current;
    if (path.length > 0) {
      const last = path[path.length - 1];
      const dist = Math.hypot(last.x - pt.x, last.y - pt.y);
      if (dist < 0.002) return; // skip if moved less than ~0.2% of page dimensions
    }
    path.push(pt);
    redrawActiveStroke();
  };
INNER_EOF
