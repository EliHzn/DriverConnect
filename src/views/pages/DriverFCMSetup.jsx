import React, { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db, messaging } from '../../firebase'; // Adjust path if needed
import { getToken, onMessage } from 'firebase/messaging';

const VAPID_PUBLIC_KEY = 'BBpE2HttzMN-Uz_Lb2lcu9IBfredug5y2sz49OPnBQ6eya-tuFBgiLr9kGJGgFfx0V78EHdRtwlM3AJClobnA4s'; // your public VAPID key

function DriverFCMSetup({ driverUid }) {
  const [fcmToken, setFcmToken] = useState(null);

  const handleEnableNotifications = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Notification permission denied');
        return;
      }

      const currentToken = await getToken(messaging, { vapidKey: VAPID_PUBLIC_KEY });
      console.log('[DriverFCMSetup] FCM token =>', currentToken);

      if (currentToken) {
        setFcmToken(currentToken);

        // In your original code, you wrote to dispatchAvailability/<driverUid>.
        // Instead, write to devices/<someDocId>, so the backend can find it:

        // Option 1) If you only expect one device per driver, you can just do:
        //    doc(db, "devices", driverUid)
        // Option 2) If you expect multiple devices, generate a stable deviceId
        //           and do doc(db, "devices", driverUid_deviceId). 
        // For example:
        const deviceId = 'web-' + Math.random().toString(36).substring(2, 10);

        await setDoc(
          doc(db, 'devices', `${driverUid}_${deviceId}`),
          {
            userId: driverUid,
            token: currentToken,
            status: 'active', // or any fields you like
          },
          { merge: true }
        );

        console.log('[DriverFCMSetup] Token saved in /devices for driver:', driverUid);
      } else {
        console.log('No FCM token received (user blocked or an error occurred).');
      }
    } catch (err) {
      console.error('Error requesting permission or retrieving token:', err);
    }
  };

  useEffect(() => {
    // Listen for foreground messages
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Foreground message received:', payload);
      // Optionally display a toast/alert/snackbar
    });
    return () => unsubscribe();
  }, []);

  return (
    <div>
      <h3>Driver FCM Setup</h3>
      <p>Driver UID: {driverUid}</p>

      {fcmToken ? (
        <>
          <p>FCM Token:</p>
          <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>{fcmToken}</pre>
        </>
      ) : (
        <button onClick={handleEnableNotifications}>Enable Notifications</button>
      )}
    </div>
  );
}

export default DriverFCMSetup;
