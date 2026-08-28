import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Capacitor } from '@capacitor/core';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
// Adding prompt: consent forces a refresh token, ensuring we get a new access token
provider.setCustomParameters({
  prompt: 'consent',
  access_type: 'offline'
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // We need to wait for getRedirectResult first before letting onAuthStateChanged decide
  let redirectCheckDone = false;
  
  getRedirectResult(auth).then((result) => {
    redirectCheckDone = true;
    if (result) {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
        if (onAuthSuccess) onAuthSuccess(result.user, cachedAccessToken);
      }
    } else {
      // If we are already signed in from a previous session, we might not have a token
      // but let's re-evaluate auth state if needed.
    }
  }).catch((e) => {
    redirectCheckDone = true;
    console.error(e);
  });

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      // If we have token, success immediately
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // We have a user but no access token (e.g. they refreshed)
        // Let's wait a moment just in case getRedirectResult is in flight
        setTimeout(() => {
          if (!cachedAccessToken) {
            if (onAuthFailure) onAuthFailure();
          }
        }, 1500);
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    if (Capacitor.isNativePlatform()) {
      // In Android Capacitor, popups are blocked. Use redirect.
      await signInWithRedirect(auth, provider);
      return null; // Page will reload
    } else {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Failed to get access token from Firebase Auth');
      }
      cachedAccessToken = credential.accessToken;
      return { user: result.user, accessToken: cachedAccessToken };
    }
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};
