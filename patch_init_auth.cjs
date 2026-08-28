const fs = require('fs');
let content = fs.readFileSync('src/lib/firebase.ts', 'utf8');

content = content.replace(
  `export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Check redirect result for mobile fallback
  getRedirectResult(auth).then((result) => {
    if (result) {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
      }
    }
  }).catch(console.error);

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};`,
  `export const initAuth = (
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
};`
);

fs.writeFileSync('src/lib/firebase.ts', content);
