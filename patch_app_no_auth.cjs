const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Remove auth imports
code = code.replace(/import \{ handleNativeTokens .*?\n/g, '');
code = code.replace(/import \{ User \} from 'firebase\/auth';\n/g, '');
code = code.replace(/import \{ syncDocuments \} from '\.\/lib\/sync';\n/g, '');

// Remove user state
code = code.replace(/const \[user, setUser\] = useState<User \| null>\(null\);\n/g, '');
code = code.replace(/const \[isSyncing, setIsSyncing\] = useState\(false\);\n/g, '');

// Remove useEffect for auth
code = code.replace(/useEffect\(\(\) => \{\n\s*const unsub = initAuth\([\s\S]*?\);\n\s*return \(\) => unsub\(\);\n\s*\}, \[\]\);\n/m, '');

// Remove onLogin and onSync and handleNativeLogin
code = code.replace(/const handleNativeLogin = async \(\) => \{[\s\S]*?\};\n/m, '');
code = code.replace(/const handleSync = async \(\) => \{[\s\S]*?\};\n/m, '');

// Replace FileManager props
code = code.replace(/<FileManager\s*onOpenFile=\{handleOpenFile\}\s*onCompressPDF=\{handleCompressPDF\}\s*onSync=\{handleSync\}\s*user=\{user\}\s*onLogin=\{handleNativeLogin\}\s*\/>/g, '<FileManager onOpenFile={handleOpenFile} onCompressPDF={handleCompressPDF} />');

fs.writeFileSync('src/App.tsx', code);
