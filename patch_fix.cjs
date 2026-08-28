const fs = require('fs');
let content = fs.readFileSync('src/components/FileManager.tsx', 'utf8');
content = content.replace(
  "Share2\n  Menu",
  "Share2,\n  Menu"
);
fs.writeFileSync('src/components/FileManager.tsx', content);
