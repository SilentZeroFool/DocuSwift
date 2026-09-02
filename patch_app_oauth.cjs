const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const importStr = "import { initOAuth } from './lib/googleOAuth';\nimport { handleNativeTokens } from './lib/firebase';";
const insertAnchor = "const initIntentHandler = async () => {";
const newInit = `
        initOAuth(tokens => {
            handleNativeTokens(tokens);
        });
`;

code = code.replace("import { initAuth, googleSignIn, logout } from './lib/firebase';", "import { initAuth, googleSignIn, logout } from './lib/firebase';\n" + importStr);
code = code.replace(insertAnchor, insertAnchor + newInit);

fs.writeFileSync('src/App.tsx', code);
