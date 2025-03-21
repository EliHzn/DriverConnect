// C:\Users\eliha\firebase\webapp\src\layout\MainLayout\Header\index.jsx

import React from 'react';
import { useTheme } from '@mui/material/styles';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';

// project imports
import useAuth from 'hooks/useAuth'; // <--- ADDED: import your custom auth hook
import useConfig from 'hooks/useConfig';
import LogoSection from '../LogoSection';
import SearchSection from './SearchSection';
import MobileSection from './MobileSection';
import ProfileSection from './ProfileSection';
import LocalizationSection from './LocalizationSection';
import MegaMenuSection from './MegaMenuSection';
import FullScreenSection from './FullScreenSection';
import NotificationSection from './NotificationSection'; // We'll pass userUid here

import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';
import { MenuOrientation, ThemeMode } from 'config';
import { IconMenu2 } from '@tabler/icons-react';

// ==============================|| MAIN NAVBAR / HEADER ||============================== //

const Header = () => {
    const theme = useTheme();
    const downMD = useMediaQuery(theme.breakpoints.down('md'));

    const { mode, menuOrientation } = useConfig();
    const { menuMaster } = useGetMenuMaster();
    const drawerOpen = menuMaster.isDashboardDrawerOpened;
    const isHorizontal = menuOrientation === MenuOrientation.HORIZONTAL && !downMD;

    // 1) Get the current user from your auth system
    const { user } = useAuth();
    // 2) Extract the firebaseUser uid or fallback to an empty string
    const userUid = user?.firebaseUser?.uid || '';

    return (
        <>
            {/* logo & toggler button */}
            <Box sx={{ width: downMD ? 'auto' : 228, display: 'flex' }}>
                <Box component="span" sx={{ display: { xs: 'none', md: 'block' }, flexGrow: 1 }}>
                    <LogoSection />
                </Box>
                {!isHorizontal && (
                    <Avatar
                        variant="rounded"
                        sx={{
                            ...theme.typography.commonAvatar,
                            ...theme.typography.mediumAvatar,
                            overflow: 'hidden',
                            transition: 'all .2s ease-in-out',
                            bgcolor: mode === ThemeMode.DARK ? 'dark.main' : 'secondary.light',
                            color: mode === ThemeMode.DARK ? 'secondary.main' : 'secondary.dark',
                            '&:hover': {
                                bgcolor: mode === ThemeMode.DARK ? 'secondary.main' : 'secondary.dark',
                                color: mode === ThemeMode.DARK ? 'secondary.light' : 'secondary.light'
                            }
                        }}
                        onClick={() => handlerDrawerOpen(!drawerOpen)}
                        color="inherit"
                    >
                        <IconMenu2 stroke={1.5} size="20px" />
                    </Avatar>
                )}
            </Box>

            {/* header search */}
            <SearchSection />
            <Box sx={{ flexGrow: 1 }} />
            <Box sx={{ flexGrow: 1 }} />

            {/* notification => pass userUid here */}
            <NotificationSection userUid={userUid} />

            {/* full screen toggler */}
            <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
                <FullScreenSection />
            </Box>

            {/* profile */}
            <ProfileSection />

            {/* mobile header */}
            <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                <MobileSection />
            </Box>
        </>
    );
};

export default Header;
