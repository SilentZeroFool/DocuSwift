const fs = require('fs');
let content = fs.readFileSync('src/components/PdfViewer.tsx', 'utf8');

content = content.replace(
  "import { LocalDocument } from '../types';",
  "import { LocalDocument } from '../types';\nimport { useSettings } from './SettingsContext';"
);

content = content.replace(
  "  const [userZoom, setUserZoom] = useState(1.0); // CSS scale (instant)",
  "  const { settings } = useSettings();\n  const [userZoom, setUserZoom] = useState(1.0); // CSS scale (instant)"
);

// update handleTouchMove zoom sensitivity
content = content.replace(
  "      const nextZoom = Math.min(Math.max(0.6, touchStartZoomRef.current * ratio), 4.0);",
  "      // Apply zoom sensitivity modifier\n      const adjustedRatio = 1 + (ratio - 1) * settings.zoomSensitivity;\n      const nextZoom = Math.min(Math.max(0.6, touchStartZoomRef.current * adjustedRatio), 4.0);"
);

// update handleTouchEnd double tap speed
content = content.replace(
  "            if (last && now - last.time < 300) {",
  "            if (last && now - last.time < settings.doubleTapSpeed) {"
);

// update handleTouchEnd animation duration
content = content.replace(
  "            const duration = 200;",
  "            const duration = settings.animationDuration;"
);

fs.writeFileSync('src/components/PdfViewer.tsx', content);
