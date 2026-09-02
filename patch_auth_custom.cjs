const fs = require('fs');

const content = `import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Capacitor } from '@capacitor/core';
import { signInWithGoogleSystemBrowser } from './googleOAuth';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({ prompt: 'consent' });

let cachedAccessToken: string | null = null;
let nativeMockUser: User | null = null;
let authStateListener: ((user: User | null) => void) | null = null;

function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return {};
  }
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (Capacitor.isNativePlatform()) {
    try {
      const storedUser = localStorage.getItem('docuswift_native_user');
      const storedToken = localStorage.getItem('docuswift_native_token');
      if (storedUser && storedToken) {
        nativeMockUser = JSON.parse(storedUser);
        cachedAccessToken = storedToken;
        if (onAuthSuccess && nativeMockUser && cachedAccessToken) {
          onAuthSuccess(nativeMockUser, cachedAccessToken);
        }
      } else {
        if (onAuthFailure) onAuthFailure();
      }
    } catch (e) {
      if (onAuthFailure) onAuthFailure();
    }
    
    // We don't subscribe to Firebase auth state if native, we just manage it ourselves
    return () => {};
  }

  return onAuthStateChanged(auth, (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (Capacitor.isNativePlatform()) {
    const tokens = await signInWithGoogleSystemBrowser();
    if (!tokens) return null; // user cancelled

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

    return { user: nativeMockUser, accessToken: cachedAccessToken };
  } else {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  if (Capacitor.isNativePlatform()) {
    nativeMockUser = null;
    cachedAccessToken = null;
    localStorage.removeItem('docuswift_native_user');
    localStorage.removeItem('docuswift_native_token');
    // Reload window to reset state
    window.location.reload();
  } else {
    await signOut(auth);
    cachedAccessToken = null;
  }
};
`;

fs.writeFileSync('src/lib/firebase.ts', content);
