import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, signInWithCredential, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Capacitor } from '@capacitor/core';
import { signInWithGoogleSystemBrowser } from './googleOAuth';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({ prompt: 'consent' });

let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      // Either signed out, or signed in with no cached Drive token (e.g. a
      // stale session after an app restart). We can't call Drive without a
      // fresh token, so treat this the same as "not signed in" and let the
      // UI prompt the user to sign in again.
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (Capacitor.isNativePlatform()) {
    // WebView-based popup/redirect sign-in is blocked by Google on Android.
    // Use the system browser (Custom Tabs) with a PKCE auth-code flow instead.
    const tokens = await signInWithGoogleSystemBrowser();
    if (!tokens) return null; // user cancelled
    const credential = GoogleAuthProvider.credential(tokens.idToken, tokens.accessToken);
    const result = await signInWithCredential(auth, credential);
    cachedAccessToken = tokens.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
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
  await signOut(auth);
  cachedAccessToken = null;
};
