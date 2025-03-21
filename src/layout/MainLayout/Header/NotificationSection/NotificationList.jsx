// C:\Users\eliha\firebase\webapp\src\layout\MainLayout\Header\NotificationSection\NotificationList.jsx

import React from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '@mui/material/styles';
import {
  Box,
  Typography
} from '@mui/material';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../../firebase';

// Tabler icons
import { IconSquareCheck, IconClipboardCheck } from '@tabler/icons-react';

// Let dayjs do fromNow()
dayjs.extend(relativeTime);

/**
 * notifications: array of { id, title, body, read, createdAt, ... }
 * showCount: how many to display (like 5, 10, etc.)
 */
function NotificationList({ notifications, showCount }) {
  const theme = useTheme();

  // We'll only display up to "showCount" items
  const display = notifications.slice(0, showCount);

  // Toggle read => set read=true or read=false
  const markAsRead = async (notifId, newVal) => {
    try {
      await updateDoc(doc(db, 'notifications', notifId), { read: newVal });
    } catch (err) {
      console.error('Error updating read:', err);
    }
  };

  if (!display.length) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2">No notifications found.</Typography>
      </Box>
    );
  }

  return (
    <>
      {display.map((notif) => {
        const createdAt = notif.createdAt?.toDate ? notif.createdAt.toDate() : null;
        const timeString = createdAt ? dayjs(createdAt).fromNow() : '';

        return (
          <Box
            key={notif.id}
            sx={{
              position: 'relative', // so we can place icons in bottom-right
              p: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
              cursor: 'default',
              '&:hover': {
                bgcolor:
                  theme.palette.mode === 'dark' ? 'grey.700' : 'grey.100'
              }
            }}
          >
            {/* Title & Body */}
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: notif.read ? 'normal' : 'bold' }}
            >
              {notif.title || 'Notification'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
              {notif.body || ''}
            </Typography>

            {/* Icons + timestamp => bottom-right */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                {timeString}
              </Typography>

              {/* Show IconSquareCheck if read=false => click => set read=true */}
              {!notif.read && (
                <Box
                  sx={{ cursor: 'pointer', color: 'primary.main' }}
                  onClick={() => markAsRead(notif.id, true)}
                >
                  <IconSquareCheck stroke={1.5} size={18} />
                </Box>
              )}

              {/* Show IconClipboardCheck if read=true => click => set read=false */}
              {notif.read && (
                <Box
                  sx={{ cursor: 'pointer', color: 'primary.main' }}
                  onClick={() => markAsRead(notif.id, false)}
                >
                  <IconClipboardCheck stroke={1.5} size={18} />
                </Box>
              )}
            </Box>
          </Box>
        );
      })}
    </>
  );
}

NotificationList.propTypes = {
  notifications: PropTypes.array,
  showCount: PropTypes.number
};

export default NotificationList;
