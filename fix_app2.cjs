const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(/<\/div>\s*\)\}\s*<\/SettingsProvider>/, '</div>\n        )}\n        </SettingsProvider>');

// Let's just fix it carefully
const lines = code.split('\n');
const fixedLines = lines.filter(l => !l.includes(')}        </SettingsProvider>'));
code = fixedLines.join('\n');
code = code.replace(')}</SettingsProvider>', ')}\n</SettingsProvider>');
code = code.replace('</div>\n        )}\n        </SettingsProvider>', '</div>\n        )}\n        </SettingsProvider>');
fs.writeFileSync('src/App.tsx', code);
