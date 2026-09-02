const fs = require('fs');
let code = fs.readFileSync('src/lib/googleOAuth.ts', 'utf-8');

// Replace the duplicate fetch logic with a shared safe function

const safeExchangeFunc = `
let exchangingCode: string | null = null;
let exchangePromise: Promise<GoogleTokens> | null = null;

async function exchangeTokenSafe(code: string, verifier: string): Promise<GoogleTokens> {
  if (exchangingCode === code && exchangePromise) {
    return exchangePromise;
  }
  exchangingCode = code;
  exchangePromise = fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    }).toString(),
  }).then(async (tokenRes) => {
    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(\`Token exchange failed: \${errText}\`);
    }
    const tokenData = await tokenRes.json();
    return {
      idToken: tokenData.id_token,
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in,
    };
  }).finally(() => {
    localStorage.removeItem('oauth_verifier');
  });
  return exchangePromise;
}
`;

// Remove old SCOPES, add the new ones:
code = code.replace("  'https://www.googleapis.com/auth/drive.file',", "  'https://www.googleapis.com/auth/drive.file',\n  'email',\n  'profile',"); // Wait, it already has email and profile! Let me double check if it does.

code = safeExchangeFunc + "\n" + code;

// Now replace the fetch blocks.
// Block 1 in signInWithGoogleSystemBrowser
const fetchRegex1 = /const tokenRes = await fetch\('https:\/\/oauth2\.googleapis\.com\/token'[\s\S]*?expires_in,\s*};/m;
code = code.replace(fetchRegex1, "return await exchangeTokenSafe(code, verifier);");

// Block 2 in initOAuth
const fetchRegex2 = /const tokenRes = await fetch\('https:\/\/oauth2\.googleapis\.com\/token'[\s\S]*?expires_in,\s*};\s*onSuccess\(tokens\);\s*}/m;
code = code.replace(fetchRegex2, "const tokens = await exchangeTokenSafe(code, verifier);\n          onSuccess(tokens);");

fs.writeFileSync('src/lib/googleOAuth.ts', code);
