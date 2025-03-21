// C:\Users\eliha\firebase\webapp\src\layout\MainLayout\MenuList\MiniDrawerLayout.jsx

import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';

// MUI
import { styled, useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import MenuIcon from '@mui/icons-material/Menu';

// Local import
import MenuList from './index';

const drawerWidth = 240;

/**
 * Mixin for the full (opened) drawer
 */
const openedMixin = (theme) => ({
    width: drawerWidth,
    transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.enteringScreen
    }),
    overflowX: 'hidden'
});

/**
 * Mixin for the mini (closed) drawer
 */
const closedMixin = (theme) => ({
    transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen
    }),
    overflowX: 'hidden',
    width: theme.spacing(7) + 1,
    [theme.breakpoints.up('sm')]: {
        width: theme.spacing(9) + 1
    }
});

/**
 * DrawerHeader - used to space content below app bar
 */
const DrawerHeader = styled('div')(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0, 1),
    ...theme.mixins.toolbar,
    justifyContent: 'flex-end'
}));

/**
 * CustomDrawer - a permanent drawer that can be either 'opened' or 'closed' (mini)
 */

const CustomDrawer = styled(Drawer, {
    shouldForwardProp: (prop) => prop !== 'open'
})(({ theme, open }) => ({
    width: drawerWidth,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    ...(open && {
        ...openedMixin(theme),
        '& .MuiDrawer-paper': openedMixin(theme)
    }),
    ...(!open && {
        ...closedMixin(theme),
        '& .MuiDrawer-paper': closedMixin(theme)
    })
}));

/**
 * MiniDrawerLayout
 * A layout component that renders:
 *  - A top Toolbar with a button to toggle the drawer
 *  - A permanent Drawer (mini variant)
 *  - Main content area that displays <Outlet /> from react-router
 */
function MiniDrawerLayout() {
    const theme = useTheme();
    const [open, setOpen] = useState(false); // local state for drawer expanded/collapsed

    // Toggle the mini drawer
    const handleDrawerToggle = () => setOpen((prev) => !prev);

    return (
        <Box sx={{ display: 'flex' }}>
            {/* Top toolbar with a toggle button (you might replace or remove if you have an AppBar) */}
            <Toolbar sx={{ width: '100%', borderBottom: '1px solid #ccc' }}>
                <IconButton onClick={handleDrawerToggle}>{open ? <ChevronLeftIcon /> : <MenuIcon />}</IconButton>
            </Toolbar>

            {/* The collapsible drawer on the left */}
            <CustomDrawer variant="permanent" open={open}>
                <DrawerHeader>
                    <IconButton onClick={handleDrawerToggle}>{open ? <ChevronLeftIcon /> : <MenuIcon />}</IconButton>
                </DrawerHeader>
                <Divider />
                {/* MenuList uses 'drawerOpen' to decide whether to show text labels or hide them */}
                <MenuList drawerOpen={open} />
            </CustomDrawer>

            {/* MAIN CONTENT AREA */}
            <Box component="main" sx={{ flexGrow: 1, p: 2 }}>
                {/* This ensures the content is pushed below the top toolbar */}
                <DrawerHeader />
                {/* Displays the nested routes or pages via React Router */}
                <Outlet />
            </Box>
        </Box>
    );
}

export default MiniDrawerLayout;
