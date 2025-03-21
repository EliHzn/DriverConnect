import React, { useEffect, useState } from 'react';
import Typography from '@mui/material/Typography';
import MainCard from 'ui-component/cards/MainCard';

import useAuth from 'hooks/useAuth';

// Firestore
import { getFirestore, doc, getDoc } from 'firebase/firestore';

// Material UI (for the table)
import { Table, TableBody, TableRow, TableCell, TableHead } from '@mui/material';

const Dashboard = () => {
  const { user } = useAuth();
  const userUid = user?.firebaseUser?.uid || '';
  const displayName =
    user?.firebaseUser?.displayName ||
    user?.firebaseUser?.customClaims?.firstName ||
    'No Name';

  // We'll store the device info from Firestore here
  const [deviceInfo, setDeviceInfo] = useState(null);

  useEffect(() => {
    if (!userUid) return; // No user logged in, do nothing

    // Retrieve deviceId from localStorage (generated in your login code)
    const deviceId = localStorage.getItem('myDeviceId');
    if (!deviceId) {
      console.log('No deviceId found in localStorage; cannot fetch device doc.');
      return;
    }

    // Firestore query
    const db = getFirestore();
    const docId = `${userUid}_${deviceId}`;
    const ref = doc(db, 'devices', docId);

    getDoc(ref)
      .then((snap) => {
        if (snap.exists()) {
          setDeviceInfo(snap.data());
        } else {
          console.log('Device doc not found:', docId);
        }
      })
      .catch((err) => {
        console.error('Error fetching device doc:', err);
      });
  }, [userUid]);

  // Helper to safely get a nested geo field
  const geo = deviceInfo?.ipInfo?.geo || {};

  return (
    <MainCard title="Dashboard">
      {/* 1) Greeting */}
      <Typography variant="h4" paragraph>
        Welcome {displayName}!
      </Typography>

      {!userUid && (
        <Typography variant="body2" color="error">
          No valid user found; cannot show device info.
        </Typography>
      )}

      {/* 2) If we have device info, display as a "report" */}
      {deviceInfo && (
        <>
          <Typography variant="h5" sx={{ mt: 2, mb: 1 }}>
            Your Device Details
          </Typography>

          <Table sx={{ mb: 2, border: '1px solid #ccc' }}>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    fontWeight: 'bold',
                    backgroundColor: '#f5f5f5',
                    borderRight: '1px solid #ccc',
                  }}
                >
                  Field
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 'bold',
                    backgroundColor: '#f5f5f5',
                  }}
                >
                  Value
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {/* IP ADDRESS */}
              <TableRow>
                <TableCell>IP Address</TableCell>
                <TableCell>{deviceInfo.ipInfo?.ipAddress || 'Unknown'}</TableCell>
              </TableRow>

              {/* Browser/OS */}
              <TableRow>
                <TableCell>Browser</TableCell>
                <TableCell>
                  {deviceInfo.userAgentParsed?.browser || 'Unknown'}{' '}
                  {deviceInfo.userAgentParsed?.browserVersion}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Operating System</TableCell>
                <TableCell>
                  {deviceInfo.userAgentParsed?.os || 'Unknown'}{' '}
                  {deviceInfo.userAgentParsed?.osVersion}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Device Vendor</TableCell>
                <TableCell>{deviceInfo.userAgentParsed?.deviceVendor || 'N/A'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Device Model</TableCell>
                <TableCell>{deviceInfo.userAgentParsed?.deviceModel || 'N/A'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Device Type</TableCell>
                <TableCell>{deviceInfo.userAgentParsed?.deviceType || 'N/A'}</TableCell>
              </TableRow>

              {/* Geo Info */}
              <TableRow>
                <TableCell>City</TableCell>
                <TableCell>{geo.city || 'N/A'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Region</TableCell>
                <TableCell>{geo.region || 'N/A'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Region Code</TableCell>
                <TableCell>{geo.region_code || 'N/A'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Country</TableCell>
                <TableCell>{geo.country_name || geo.country || 'N/A'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Postal Code</TableCell>
                <TableCell>{geo.postal || 'N/A'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Latitude</TableCell>
                <TableCell>{geo.latitude != null ? geo.latitude : 'N/A'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Longitude</TableCell>
                <TableCell>{geo.longitude != null ? geo.longitude : 'N/A'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Timezone</TableCell>
                <TableCell>{geo.timezone || 'N/A'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Organization</TableCell>
                <TableCell>{geo.org || 'N/A'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>ASN</TableCell>
                <TableCell>{geo.asn || 'N/A'}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </>
      )}

      {/* 3) If no device doc found but user is logged in */}
      {!deviceInfo && userUid && (
        <Typography variant="body2" paragraph>
          No device info found for user <em>{userUid}</em>. Perhaps no device doc was created, or it’s stale.
        </Typography>
      )}
    </MainCard>
  );
};

export default Dashboard;
