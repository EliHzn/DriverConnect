// C:\Users\eliha\firebase\webapp\src\firebase.js

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported } from 'firebase/messaging';

// 1) Your Firebase config:
const firebaseConfig = {
  apiKey: 'AIzaSyBvGtSb_CTN9EMRurPdH4LD5rFg6hxSn94',
  authDomain: 'benandnino-ed666.firebaseapp.com',
  databaseURL: 'https://benandnino-ed666-default-rtdb.firebaseio.com',
  projectId: 'benandnino-ed666',
  storageBucket: 'benandnino-ed666.firebasestorage.app',
  messagingSenderId: '1026673356608',
  appId: '1:1026673356608:web:dc3f952696cc30967b14a5',
  measurementId: 'G-6C83WBGPFS'
};

// 2) Initialize the Firebase app:
const app = initializeApp(firebaseConfig);

// 3) Export common services (Auth, Firestore, Storage):
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// 4) Conditionally enable Messaging (avoiding iOS crash):
let localMessaging = null; // will remain null if not supported
isSupported()
  .then((supported) => {
    if (supported) {
      localMessaging = getMessaging(app);
      console.log('Firebase Messaging initialized.');
    } else {
      console.log('Skipping Firebase Messaging: environment not supported.');
    }
  })
  .catch((err) => {
    // If isSupported() throws or something unexpected happens:
    console.error('Error checking Messaging support:', err);
  });

// 5) Export references:
export { app };
// Because messaging may be null if not supported, we export it as well:
export const messaging = localMessaging;
