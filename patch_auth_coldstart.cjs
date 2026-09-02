const fs = require('fs');
let code = fs.readFileSync('src/lib/googleOAuth.ts', 'utf-8');

// Export an initOAuth function to handle cold-starts
const newFunc = `
export async function initOAuth(onSuccess: (tokens: GoogleTokens) => void) {
  CapApp.addListener('appUrlOpen', async (data) => {
    if (data.url.startsWith(REDIRECT_URI)) {
      await Browser.close().catch(() => {});
      const url = new URL(data.url.replace(REDIRECT_URI, 'https://redirect'));
      const code = url.searchParams.get('code');
      const verifier = localStorage.getItem('oauth_verifier');
      if (code && verifier) {
        try {
          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: CLIENT_ID,
              code,
              code_verifier: verifier,
              grant_type: 'authorization_code',
              redirect_uri: REDIRECT_URI,
            }).toString(),
          });
          if (tokenRes.ok) {
            const tokenData = await tokenRes.json();
            const tokens = {
              idToken: tokenData.id_token,
              accessToken: tokenData.access_token,
              expiresIn: tokenData.expires_in,
            };
            onSuccess(tokens);
          }
        } catch(e) {
          console.error("Token exchange failed", e);
        }
      }
    }
  });
}
`;

code = code.replace("const codePromise = new Promise", `localStorage.setItem('oauth_verifier', verifier);\n  const codePromise = new Promise`);
code = code + "\n" + newFunc;

fs.writeFileSync('src/lib/googleOAuth.ts', code);
