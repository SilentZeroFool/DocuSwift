
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
      throw new Error(`Token exchange failed: ${errText}`);
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

import { Browser } from '@capacitor/browser';
import { App as CapApp } from '@capacitor/app';

// This client ID must be a Google Cloud Console OAuth client of type "iOS"
// (yes, even though this is Android). The "iOS" type identifies the app by
// bundle ID only, with no SHA-1/package-signature check, which is what lets
// us use a custom URL scheme redirect from a plain Capacitor app for free,
// with no Play Console enrollment and no keystore/signing setup.
// Create it at: https://console.cloud.google.com/apis/credentials
const CLIENT_ID = '679197470351-llts0qkn90ftqntnb0ims1hv51u556rn.apps.googleusercontent.com';
const REDIRECT_URI = 'com.docuswift.app:/oauth2redirect';
const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
].join(' ');

export interface GoogleTokens {
  idToken: string;
  accessToken: string;
  expiresIn: number;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const verifier = base64UrlEncode(verifierBytes);

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(new Uint8Array(digest));

  return { verifier, challenge };
}

/**
 * Starts the Google sign-in flow in the system browser (Chrome Custom Tabs),
 * waits for the redirect back into the app, and exchanges the code for tokens.
 * Resolves with null if the user cancels (closes the browser tab).
 */
export async function signInWithGoogleSystemBrowser(): Promise<GoogleTokens | null> {
  const { verifier, challenge } = await generatePkcePair();

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('access_type', 'offline');

  let settled = false;
  let resolveCode: (code: string | null) => void;
  localStorage.setItem('oauth_verifier', verifier);
  const codePromise = new Promise<string | null>((resolve) => { resolveCode = resolve; });

  const urlListener = await CapApp.addListener('appUrlOpen', async (data) => {
    if (settled || !data.url.startsWith(REDIRECT_URI)) return;
    settled = true;
    await Browser.close().catch(() => {});
    const url = new URL(data.url.replace(REDIRECT_URI, 'https://redirect'));
    resolveCode(url.searchParams.get('code'));
  });

  // If the user closes the browser tab manually without completing sign-in.
  const finishedListener = await Browser.addListener('browserFinished', () => {
    if (settled) return;
    settled = true;
    resolveCode(null);
  });

  await Browser.open({ url: authUrl.toString() });

  const code = await codePromise;
  await urlListener.remove();
  await finishedListener.remove();
  if (!code) return null;

  return await exchangeTokenSafe(code, verifier);
}


export async function initOAuth(onSuccess: (tokens: GoogleTokens) => void) {
  CapApp.addListener('appUrlOpen', async (data) => {
    if (data.url.startsWith(REDIRECT_URI)) {
      await Browser.close().catch(() => {});
      const url = new URL(data.url.replace(REDIRECT_URI, 'https://redirect'));
      const code = url.searchParams.get('code');
      const verifier = localStorage.getItem('oauth_verifier');
      if (code && verifier) {
        try {
          const tokens = await exchangeTokenSafe(code, verifier);
          onSuccess(tokens);
        } catch(e) {
          console.error("Token exchange failed", e);
        }
      }
    }
  });
}
