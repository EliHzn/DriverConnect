// C:\Users\eliha\firebase\webapp\src\layout\MainLayout\Header\NotificationSection\index.jsx
import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Avatar,
  Paper,
  Popper,
  ClickAwayListener,
  Grid,
  Stack,
  TextField,
  Button,
  CardActions,
  Typography,
  Badge,
  Snackbar,
  Alert,
  Divider,
  useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import PerfectScrollbar from 'react-perfect-scrollbar';
import { IconBell } from '@tabler/icons-react';

// Firestore
import { db } from '../../../../firebase';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc
} from 'firebase/firestore';

// Local components
import MainCard from 'ui-component/cards/MainCard';
import Transitions from 'ui-component/extended/Transitions';
import NotificationList from './NotificationList';
import { ThemeMode } from 'config';

// Filter dropdown options
const statusOptions = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' }
];

const NotificationSection = ({ userUid }) => {
  const theme = useTheme();
  const downMD = useMediaQuery(theme.breakpoints.down('md'));

  // Popper (the bell dropdown)
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  // Filter + pagination
  const [filterValue, setFilterValue] = useState('unread');
  const [showCount, setShowCount] = useState(5);

  // All notifications from Firestore
  const [allNotifications, setAllNotifications] = useState([]);
  // For the badge (unread count)
  const [unreadCount, setUnreadCount] = useState(0);

  // Audio + “defer on user click” logic
  const audioRef = useRef(null);
  const [pendingPlay, setPendingPlay] = useState(false);

  // For beep logic => track previous array
  const prevNotifsRef = useRef([]);

  // Snackbar => bottom-center for new arrivals
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Setup audio object once
  useEffect(() => {
    if (!audioRef.current) {
      // Must be relative to /public
      audioRef.current = new Audio('/newmail.mp3');
    }
  }, []);

  // If "pendingPlay" => attach one-click listener that tries `.play()` again
  useEffect(() => {
    if (!pendingPlay) return;

    const handleDocClick = () => {
      audioRef.current
        ?.play()
        .then(() => {
          console.log('Deferred audio played on user click.');
          setPendingPlay(false);
        })
        .catch((err) => {
          console.warn('Still blocked after user click:', err);
          // remain pending
        });
    };

    document.addEventListener('click', handleDocClick, { once: true });
    return () => {
      document.removeEventListener('click', handleDocClick, { once: true });
    };
  }, [pendingPlay]);

  // Firestore real-time
  useEffect(() => {
    if (!userUid) return;

    const qRef = query(
      collection(db, 'notifications'),
      where('recipientUid', '==', userUid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(qRef, (snapshot) => {
      const arr = [];
      snapshot.forEach((snap) => {
        const data = snap.data() || {};
        if (!data.archived) {
          arr.push({ id: snap.id, ...data });
        }
      });

      setAllNotifications(arr);
      // Count unread
      const totalUnread = arr.filter((n) => !n.read).length;
      setUnreadCount(totalUnread);

      // Compare with previous
      const prev = prevNotifsRef.current;
      if (prev.length && arr.length > prev.length) {
        // newly arrived
        const prevIds = new Set(prev.map((p) => p.id));
        const newlyAdded = arr.filter((n) => !prevIds.has(n.id));
        if (newlyAdded.length) {
          // Try beep
          audioRef.current
            ?.play()
            .then(() => {
              setSnackbarMessage(newlyAdded[0].title || 'New Notification');
              setSnackbarOpen(true);
            })
            .catch((err) => {
              console.warn('Audio play blocked => deferring:', err);
              setPendingPlay(true);
            });
        }
      }

      prevNotifsRef.current = arr;
    });

    return () => unsub();
  }, [userUid]);

  // Popper toggle
  const handleToggle = () => setOpen((o) => !o);
  const handleClose = (event) => {
    if (anchorRef.current && anchorRef.current.contains(event.target)) return;
    setOpen(false);
  };
  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current && !open) {
      anchorRef.current?.focus();
    }
    prevOpen.current = open;
  }, [open]);

  // Filter changes
  const handleFilterChange = (e) => {
    setFilterValue(e.target.value);
    setShowCount(5); // reset pagination
  };

  // Mark all read
  const handleMarkAllRead = async () => {
    try {
      const unread = allNotifications.filter((n) => !n.read);
      for (const n of unread) {
        await updateDoc(doc(db, 'notifications', n.id), { read: true });
      }
    } catch (err) {
      console.error('Error marking all read:', err);
    }
  };

  // “View More” => load 5 more
  const handleViewMore = () => {
    const disp = getFilteredNotifs();
    if (showCount >= disp.length) return; // no more to show
    setShowCount((c) => c + 5);
  };

  // Filter logic
  const getFilteredNotifs = () => {
    let arr = [...allNotifications];
    if (filterValue === 'unread') {
      arr = arr.filter((n) => !n.read);
    } else if (filterValue === 'read') {
      arr = arr.filter((n) => n.read);
    }
    return arr;
  };
  const displayNotifs = getFilteredNotifs();

  // infinite scroll => when user hits the bottom we call handleViewMore
  const onScrollReachEnd = () => handleViewMore();

  return (
    <>
      {/* Snackbar => bottom-center */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="info" onClose={() => setSnackbarOpen(false)}>
          {snackbarMessage}
        </Alert>
      </Snackbar>

      {/* Bell + unread badge */}
      <Box sx={{ ml: 2 }}>
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <Avatar
            variant="rounded"
            sx={{
              transition: 'all .2s ease-in-out',
              cursor: 'pointer',
              bgcolor:
                theme.palette.mode === ThemeMode.DARK ? 'dark.main' : 'secondary.light',
              color:
                theme.palette.mode === ThemeMode.DARK ? 'warning.dark' : 'secondary.dark',
              '&:hover': {
                bgcolor:
                  theme.palette.mode === ThemeMode.DARK ? 'warning.dark' : 'secondary.dark',
                color:
                  theme.palette.mode === ThemeMode.DARK ? 'grey.800' : 'secondary.light'
              }
            }}
            ref={anchorRef}
            onClick={handleToggle}
          >
            <IconBell stroke={1.5} size="20px" />
          </Avatar>
        </Badge>
      </Box>

      {/* Popper => Notification Modal */}
      <Popper
        placement={downMD ? 'bottom' : 'bottom-end'}
        open={open}
        anchorEl={anchorRef.current}
        role={undefined}
        transition
        disablePortal
        modifiers={[
          {
            name: 'offset',
            options: {
              offset: [downMD ? 5 : 0, 20]
            }
          }
        ]}
      >
        {({ TransitionProps }) => (
          <ClickAwayListener onClickAway={handleClose}>
            <Transitions
              position={downMD ? 'top' : 'top-right'}
              in={open}
              {...TransitionProps}
            >
              <Paper>
                {open && (
                  <MainCard
                    border={false}
                    elevation={16}
                    content={false}
                    boxShadow
                    shadow={theme.shadows[16]}
                    sx={{
                      overflow: 'hidden',
                      // Increase minWidth to avoid label overlap
                      minWidth: downMD ? 320 : 400
                    }}
                  >
                    {/* Header => Title + Mark all read */}
                    <Grid container direction="column" spacing={2}>
                      <Grid item xs={12}>
                        <Grid
                          container
                          alignItems="center"
                          justifyContent="space-between"
                          sx={{ pt: 2, px: 2 }}
                        >
                          <Grid item>
                            <Stack direction="row" spacing={2}>
                              <Typography variant="subtitle1">Notifications</Typography>
                            </Stack>
                          </Grid>
                          <Grid item>
                            <Typography
                              variant="subtitle2"
                              color="primary"
                              sx={{ cursor: 'pointer' }}
                              onClick={handleMarkAllRead}
                            >
                              Mark all read
                            </Typography>
                          </Grid>
                        </Grid>
                      </Grid>

                      {/* Filter */}
                      <Grid item xs={12} sx={{ px: 2 }}>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          label="Filter"
                          value={filterValue}
                          onChange={handleFilterChange}
                          SelectProps={{ native: true }}
                          InputLabelProps={{ shrink: true }}
                          sx={{ mt: 1 }}
                        >
                          {statusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </TextField>
                      </Grid>

                      <Grid item xs={12}>
                        <Divider sx={{ my: 0 }} />
                      </Grid>

                      {/* Scrollable => about 300px high => infinite “View More” */}
                      <Grid item xs={12}>
                        <PerfectScrollbar
                          style={{
                            maxHeight: '300px',
                            overflowX: 'hidden'
                          }}
                          onYReachEnd={onScrollReachEnd}
                        >
                          <NotificationList
                            notifications={displayNotifs}
                            showCount={showCount}
                          />
                        </PerfectScrollbar>
                      </Grid>
                    </Grid>

                    {/* Footer => 'View More' */}
                    <CardActions sx={{ p: 1.25, justifyContent: 'flex-end' }}>
                      <Button size="small" onClick={handleViewMore}>
                        View More
                      </Button>
                    </CardActions>
                  </MainCard>
                )}
              </Paper>
            </Transitions>
          </ClickAwayListener>
        )}
      </Popper>
    </>
  );
};

export default NotificationSection;
