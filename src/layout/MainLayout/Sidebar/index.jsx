// C:\Users\eliha\firebase\webapp\src\layout\MainLayout\Sidebar\index.jsx
import { memo, useMemo } from 'react';

// material-ui
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import useMediaQuery from '@mui/material/useMediaQuery';

// third-party
import PerfectScrollbar from 'react-perfect-scrollbar';

// project imports
import MenuList from '../MenuList'; // <-- We import your Firestore-based menu
import LogoSection from '../LogoSection';
import MiniDrawerStyled from './MiniDrawerStyled';
import Chip from 'ui-component/extended/Chip';

import useConfig from 'hooks/useConfig';
import { MenuOrientation } from 'config';
import { drawerWidth } from 'store/constant';

import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';

// ==============================|| SIDEBAR DRAWER ||============================== //

const Sidebar = () => {
    // For responsive checks
    const downMD = useMediaQuery((theme) => theme.breakpoints.down('md'));

    // The global menu state from your store
    const { menuMaster } = useGetMenuMaster();
    const drawerOpen = menuMaster.isDashboardDrawerOpened; // boolean controlling open/close

    const { menuOrientation, miniDrawer } = useConfig();

    // The 'logo' section at the top of the sidebar
    const logo = useMemo(
        () => (
            <Box sx={{ display: 'flex', p: 2 }}>
                <LogoSection />
            </Box>
        ),
        []
    );

    // The main drawer content
    const drawer = useMemo(() => {
        // If orientation is vertical & drawer is open, we do extra content
        const isVerticalOpen = menuOrientation === MenuOrientation.VERTICAL && drawerOpen;

        const drawerContent = (
            <>
                <Stack direction="row" justifyContent="center" sx={{ mb: 2 }}>
                    <Chip label={import.meta.env.VITE_APP_VERSION} disabled chipcolor="secondary" size="small" sx={{ cursor: 'pointer' }} />
                </Stack>
            </>
        );

        // We adjust spacing if the drawer is open vs. closed
        let drawerSX = { paddingLeft: '0px', paddingRight: '0px', marginTop: '20px' };
        if (drawerOpen) {
            drawerSX = { paddingLeft: '16px', paddingRight: '16px', marginTop: '0px' };
        }

        return (
            <>
                {downMD ? (
                    // On smaller screens
                    <Box sx={drawerSX}>
                        {/*
                          IMPORTANT:
                          We pass 'drawerOpen' so subheaders & item titles can show in expanded mode
                        */}
                        <MenuList drawerOpen={drawerOpen} />
                        {isVerticalOpen && drawerContent}
                    </Box>
                ) : (
                    // On bigger screens, with perfect-scrollbar
                    <PerfectScrollbar style={{ height: 'calc(100vh - 88px)', ...drawerSX }}>
                        <MenuList drawerOpen={drawerOpen} />
                        {isVerticalOpen && drawerContent}
                    </PerfectScrollbar>
                )}
            </>
        );
    }, [downMD, drawerOpen, menuOrientation]);

    return (
        <Box component="nav" sx={{ flexShrink: { md: 0 }, width: { xs: 'auto', md: drawerWidth } }} aria-label="mailbox folders">
            {downMD || (miniDrawer && drawerOpen) ? (
                // 'temporary' or 'persistent' drawer for smaller screens or if mini drawer is open
                <Drawer
                    variant={downMD ? 'temporary' : 'persistent'}
                    anchor="left"
                    open={drawerOpen}
                    onClose={() => handlerDrawerOpen(!drawerOpen)}
                    sx={{
                        '& .MuiDrawer-paper': {
                            mt: downMD ? 0 : 11,
                            zIndex: 1099,
                            width: drawerWidth,
                            bgcolor: 'background.default',
                            color: 'text.primary',
                            borderRight: 'none'
                        }
                    }}
                    ModalProps={{ keepMounted: true }}
                    color="inherit"
                >
                    {downMD && logo}
                    {drawer}
                </Drawer>
            ) : (
                // The mini drawer style for normal screens
                <MiniDrawerStyled variant="permanent" open={drawerOpen}>
                    {logo}
                    {drawer}
                </MiniDrawerStyled>
            )}
        </Box>
    );
};

export default memo(Sidebar);
