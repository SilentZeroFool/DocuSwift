const fs = require('fs');

// APP.TSX
let appCode = fs.readFileSync('src/App.tsx', 'utf-8');

// Strip out initAuth, logout, googleSignIn imports
appCode = appCode.replace(/import \{ initAuth, googleSignIn, logout \} from '\.\/lib\/firebase';\n/g, '');
appCode = appCode.replace(/import \{ initOAuth \} from '\.\/lib\/googleOAuth';\n/g, '');

// Replace user state and effects
const userStateRegex = /const \[user, setUser\] = useState.*?;\n/g;
appCode = appCode.replace(userStateRegex, '');
const isSyncingRegex = /const \[isSyncing, setIsSyncing\] = useState\(false\);\n/g;
appCode = appCode.replace(isSyncingRegex, '');

// Strip the whole useEffect that does auth
appCode = appCode.replace(/const unsub = initAuth\([\s\S]*?return \(\) => \{\n\s*unsub\(\);\n\s*CapApp\.removeAllListeners\(\);\n\s*\};\n\s*\}, \[\]\);/m, 
`return () => { CapApp.removeAllListeners(); };
  }, []);`);

appCode = appCode.replace(/const handleLogin = async \(\) => \{[\s\S]*?alert\("Login failed: " \+ msg\);\n\s*\}\n\s*\};\n/m, '');
appCode = appCode.replace(/const handleSync = async \(\) => \{[\s\S]*?setIsSyncing\(false\);\n\s*\}\n\s*\};\n/m, '');

// replace FileManager invocation
appCode = appCode.replace(/onSync=\{handleSync\}\n\s*user=\{user\}\n\s*onLogin=\{handleLogin\}/m, '');

// strip the syncing indicator
appCode = appCode.replace(/\{isSyncing && \([\s\S]*?\}\)/m, '');

fs.writeFileSync('src/App.tsx', appCode);

// FILEMANAGER.TSX
let fmCode = fs.readFileSync('src/components/FileManager.tsx', 'utf-8');
fmCode = fmCode.replace(/import \{ logout \} from '\.\.\/lib\/firebase';\n/g, '');
fmCode = fmCode.replace(/onSync: \(\) => void;\n\s*user: any;\n\s*onLogin: \(\) => void;/m, '');
fmCode = fmCode.replace(/onSync,\n\s*user,\n\s*onLogin/m, '');
fmCode = fmCode.replace(/onSync, user, onLogin/m, '');
fmCode = fmCode.replace(/\{user && \([\s\S]*?<Cloud className="w-5 h-5" \/>[\s\S]*?Backup to Google Drive[\s\S]*?<\/button>\n\s*\)\}/m, '');
fmCode = fmCode.replace(/\{user \? \([\s\S]*?Logout \(\{user.displayName \|\| user.email \|\| 'User'\}\)[\s\S]*?<\/button>\n\s*\) : \([\s\S]*?<\/button>\n\s*\)\}/m, '');

fs.writeFileSync('src/components/FileManager.tsx', fmCode);

