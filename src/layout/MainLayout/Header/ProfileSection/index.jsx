// C:\Users\eliha\firebase\webapp\src\layout\MainLayout\Header\ProfileSection\index.jsx

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import { useTheme } from '@mui/material/styles';
import {
    Box,
    Paper,
    List,
    Divider,
    Stack,
    ClickAwayListener,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Popper,
    Typography,
    Avatar,
    Chip
} from '@mui/material';
import PerfectScrollbar from 'react-perfect-scrollbar';

// project imports
import MainCard from 'ui-component/cards/MainCard';
import Transitions from 'ui-component/extended/Transitions';
import useAuth from 'hooks/useAuth';
import useConfig from 'hooks/useConfig';
import { ThemeMode } from 'config';
import { doc, getDoc } from 'firebase/firestore';
import { db } from 'firebase'; // adjust path to your firebase.js

// icons
import { IconLogout, IconSettings } from '@tabler/icons-react';

/* -----------------------------------------
   1) Build user initials from first/last 
------------------------------------------*/
function getInitials(first = '', last = '') {
    if (!first && !last) return '';
    return (first[0] + last[0]).toUpperCase();
}

/* -----------------------------------------
   2) Format role => "super_admin" => "Super Admin"
------------------------------------------*/
function formatRole(rawRole = '') {
    return rawRole
        .replace(/_/g, ' ')
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

const ProfileSection = () => {
    const theme = useTheme();
    const { mode, borderRadius } = useConfig();
    const navigate = useNavigate();

    // From your custom auth hook => { user, logout },
    // user should have .role, .firstName, .lastName, etc.
    const { user, logout } = useAuth();

    // Manage menu popper open state
    const [open, setOpen] = useState(false);
    const anchorRef = useRef(null);

    // Store the role color (fetched from Firestore)
    const [roleColor, setRoleColor] = useState('#888');

    // On mount or if user.role changes => fetch /roles/{user.role} doc => get .color
    useEffect(() => {
        (async () => {
            if (user?.role) {
                try {
                    const snap = await getDoc(doc(db, 'roles', user.role));
                    if (snap.exists()) {
                        const data = snap.data();
                        if (data.color) {
                            setRoleColor(data.color);
                        } else {
                            setRoleColor('#888');
                        }
                    } else {
                        // fallback
                        setRoleColor('#888');
                    }
                } catch (err) {
                    console.error('Error fetching role color:', err);
                    setRoleColor('#888');
                }
            } else {
                setRoleColor('#888');
            }
        })();
    }, [user?.role]);

    // For focusing after close
    const prevOpen = useRef(open);
    useEffect(() => {
        if (prevOpen.current === true && open === false) {
            anchorRef.current?.focus();
        }
        prevOpen.current = open;
    }, [open]);

    // Toggling
    const handleToggle = () => {
        setOpen((prev) => !prev);
    };

    const handleClose = (event) => {
        if (anchorRef.current && anchorRef.current.contains(event.target)) {
            return;
        }
        setOpen(false);
    };

    // Possibly let them navigate to some settings route
    const handleListItemClick = (event, index, route = '') => {
        if (route) navigate(route);
        setOpen(false);
    };

    const handleLogout = async () => {
        try {
            await logout();
            setOpen(false);
        } catch (err) {
            console.error(err);
        }
    };

    // Build name/initials
    const firstName = user?.firstName || '';
    const lastName = user?.lastName || '';
    const initials = getInitials(firstName, lastName);
    const displayName = (firstName + ' ' + lastName).trim() || 'No Name';
    const displayRole = user?.role ? formatRole(user.role) : '';

    return (
        <>
            {/* Chip with the Avatar + gear icon */}
            <Chip
                sx={{
                    ml: 2,
                    height: '48px',
                    alignItems: 'center',
                    borderRadius: '27px',
                    transition: 'all .2s ease-in-out',
                    borderColor: mode === ThemeMode.DARK ? 'dark.main' : 'primary.light',
                    bgcolor: mode === ThemeMode.DARK ? 'dark.main' : 'primary.light',
                    '&[aria-controls="menu-list-grow"], &:hover': {
                        borderColor: 'primary.main',
                        bgcolor: `${theme.palette.primary.main} !important`,
                        color: 'primary.light',
                        '& svg': {
                            stroke: theme.palette.primary.light
                        }
                    },
                    '& .MuiChip-label': {
                        lineHeight: 0
                    }
                }}
                // The avatar portion
                icon={
                    <Avatar
                        alt="user-avatar"
                        ref={anchorRef}
                        sx={{
                            // original dimension from your code snippet
                            ...theme.typography.mediumAvatar,
                            margin: '8px 0 8px 8px !important',
                            cursor: 'pointer',
                            bgcolor: roleColor, // loaded from Firestore doc
                            fontWeight: 'bold', // bold letters
                            color: '#fff'
                        }}
                    >
                        {initials}
                    </Avatar>
                }
                // The label is the gear icon
                label={<IconSettings stroke={1.5} size="24px" />}
                variant="outlined"
                ref={anchorRef}
                onClick={handleToggle}
                color="primary"
                aria-label="user-account"
            />

            {/* Popper menu */}
            <Popper
                placement="bottom"
                open={open}
                anchorEl={anchorRef.current}
                role={undefined}
                transition
                disablePortal
                modifiers={[
                    {
                        name: 'offset',
                        options: { offset: [0, 14] }
                    }
                ]}
            >
                {({ TransitionProps }) => (
                    <ClickAwayListener onClickAway={handleClose}>
                        <Transitions in={open} {...TransitionProps}>
                            <Paper>
                                {open && (
                                    <MainCard border={false} elevation={16} content={false} boxShadow shadow={theme.shadows[16]}>
                                        <PerfectScrollbar
                                            style={{
                                                height: '100%',
                                                maxHeight: 'calc(100vh - 250px)',
                                                overflowX: 'hidden'
                                            }}
                                        >
                                            <Box sx={{ p: 2 }}>
                                                {/* show user’s name & role */}
                                                <Stack direction="column" spacing={0.25} mb={2}>
                                                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                                                        {displayName}
                                                    </Typography>
                                                    <Typography variant="subtitle2">{displayRole}</Typography>
                                                </Stack>
                                                <Divider sx={{ mb: 2 }} />

                                                {/* no search, no upgrade plan, no toggles */}
                                                <List
                                                    component="nav"
                                                    sx={{
                                                        width: '100%',
                                                        maxWidth: 350,
                                                        minWidth: 300,
                                                        borderRadius: `${borderRadius}px`,
                                                        '& .MuiListItemButton-root': { mt: 0.5 }
                                                    }}
                                                >
                                                    {/* Account Settings or something if needed */}
                                                    <ListItemButton onClick={(event) => handleListItemClick(event, 0, '/account-settings')}>
                                                        <ListItemIcon>
                                                            <IconSettings stroke={1.5} size="20px" />
                                                        </ListItemIcon>
                                                        <ListItemText primary={<Typography variant="body2">Account Settings</Typography>} />
                                                    </ListItemButton>

                                                    {/* Logout */}
                                                    <ListItemButton onClick={handleLogout}>
                                                        <ListItemIcon>
                                                            <IconLogout stroke={1.5} size="20px" />
                                                        </ListItemIcon>
                                                        <ListItemText primary={<Typography variant="body2">Logout</Typography>} />
                                                    </ListItemButton>
                                                </List>
                                            </Box>
                                        </PerfectScrollbar>
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

export default ProfileSection;
