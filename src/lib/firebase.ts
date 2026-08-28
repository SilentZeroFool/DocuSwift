import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Use default Storage bucket from config, but since we use REST or Firebase Storage SDK, wait...
// Do we have firebase/storage installed? It's part of `firebase` package.
import { getStorage } from 'firebase/storage';
export const storage = getStorage(app);
