const fs = require('fs');
let code = fs.readFileSync('src/lib/firebase.ts', 'utf-8');

const exportFunc = `
export const handleNativeTokens = (tokens: any) => {
    cachedAccessToken = tokens.accessToken;
    const payload = parseJwt(tokens.idToken);
    
    nativeMockUser = {
      uid: payload.sub || 'native_user',
      email: payload.email || 'user@gmail.com',
      displayName: payload.name || 'Google User',
      photoURL: payload.picture || '',
      emailVerified: true,
      isAnonymous: false,
      metadata: {},
      providerData: [],
      refreshToken: '',
      tenantId: null,
      delete: async () => {},
      getIdToken: async () => tokens.idToken,
      getIdTokenResult: async () => ({} as any),
      reload: async () => {},
      toJSON: () => ({})
    } as unknown as User;

    localStorage.setItem('docuswift_native_user', JSON.stringify(nativeMockUser));
    localStorage.setItem('docuswift_native_token', cachedAccessToken);
    
    // Trigger auth state change manually if possible, or just reload to pick it up in initAuth
    window.location.reload();
};
`;

code = code + "\n" + exportFunc;
fs.writeFileSync('src/lib/firebase.ts', code);
