// src/hooks/useFCMToken.js
import { useState, useEffect } from 'react';
import { messaging } from '../config/firebase';
import { getToken, onMessage } from 'firebase/messaging';

export function useFCMToken(vapidKey) {
  const [fcmToken, setFcmToken] = useState(null);

  useEffect(() => {
    async function requestPermissionAndToken() {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        try {
          const currentToken = await getToken(messaging, { vapidKey });
          if (currentToken) {
            setFcmToken(currentToken);
          } else {
            console.log('No registration token available. Request permission again?');
          }
        } catch (err) {
          console.error('Error retrieving token:', err);
        }
      } else {
        console.log('Notification permission not granted');
      }
    }

    requestPermissionAndToken();

    // Optional: handle foreground messages
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Received foreground message:', payload);
      // e.g., play an audio alert or show a toast
    });

    return () => unsubscribe();
  }, [vapidKey]);

  return fcmToken;
}
