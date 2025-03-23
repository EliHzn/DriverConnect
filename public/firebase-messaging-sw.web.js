/* 
  firebase-messaging-sw.js 
  Place this in your public/ folder so it ends up in your final build output.
  If your "public": "webapp/dist", then ensure it's copied into dist/.
*/

importScripts('https://www.gstatic.com/firebasejs/9.17.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.17.2/firebase-messaging-compat.js');

/* 
  1) Initialize Firebase using your config:
     (exact values from your snippet)
*/
firebase.initializeApp({
  apiKey: "AIzaSyBvGtSb_CTN9EMRurPdH4LD5rFg6hxSn94",
  authDomain: "benandnino-ed666.firebaseapp.com",
  databaseURL: "https://benandnino-ed666-default-rtdb.firebaseio.com",
  projectId: "benandnino-ed666",
  storageBucket: "benandnino-ed666.firebasestorage.app",
  messagingSenderId: "1026673356608",
  appId: "1:1026673356608:web:dc3f952696cc30967b14a5",
  measurementId: "G-6C83WBGPFS"
});

/* 
  2) Grab the Messaging instance 
*/
const messaging = firebase.messaging();

/* 
  3) (Optional) Listen for background messages

  This event fires when a push notification arrives and 
  the page is *not* in focus. You can customize the 
  displayed notification here if you like, or rely on FCM defaults.
*/
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  // Basic example of building a custom notification
  const notificationTitle = payload.notification?.title || 'Background Title';
  const notificationOptions = {
    body: payload.notification?.body || 'Background Body',
    icon: '/firebase-logo.png'
  };

  // Show the notification
  self.registration.showNotification(notificationTitle, notificationOptions);
});
