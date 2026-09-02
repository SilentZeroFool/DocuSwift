const fs = require('fs');

let content = fs.readFileSync('src/components/SettingsContext.tsx', 'utf-8');
content = content.replace(
  'animationDuration: number; // e.g. 0 to 500 ms\n}',
  'animationDuration: number; // e.g. 0 to 500 ms\n  panningSpeed: number; // e.g. 0.5 to 3.0\n}'
);

content = content.replace(
  'animationDuration: 200,\n};',
  'animationDuration: 200,\n  panningSpeed: 1.0,\n};'
);

fs.writeFileSync('src/components/SettingsContext.tsx', content);
