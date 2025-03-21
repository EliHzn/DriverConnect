// C:\Users\eliha\firebase\webapp\src\firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
// Add the messaging import:
import { getMessaging } from 'firebase/messaging';

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

// 1) Initialize
const app = initializeApp(firebaseConfig);

// 2) Export common utilities
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// 3) NEW: Export messaging object
export const messaging = getMessaging(app);

// This file is your single point of Firebase init for the front-end.
