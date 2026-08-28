const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  "import { ThemeProvider } from './components/ThemeContext';",
  "import { ThemeProvider } from './components/ThemeContext';\nimport { SettingsProvider } from './components/SettingsContext';"
);

content = content.replace(
  "<ThemeProvider>",
  "<ThemeProvider>\n    <SettingsProvider>"
);

content = content.replace(
  "</ThemeProvider>",
  "    </SettingsProvider>\n    </ThemeProvider>"
);

fs.writeFileSync('src/App.tsx', content);
