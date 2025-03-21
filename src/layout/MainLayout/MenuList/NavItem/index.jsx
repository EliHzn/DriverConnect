// C:\Users\eliha\firebase\webapp\src\layout\MainLayout\MenuList\NavItem\index.jsx

import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, matchPath, useLocation } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { Box, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { IconCircle } from '@tabler/icons-react';

import useAuth from 'hooks/useAuth';

// Fallback for API URL
const apiUrl = import.meta.env.VITE_APP_API_URL || '';

const NavItem = ({ item, level, drawerOpen }) => {
    const theme = useTheme();
    const { pathname } = useLocation();
    const { user } = useAuth();

    // Holds fetched SVG markup (if any)
    const [svgMarkup, setSvgMarkup] = useState('');

    // Fetch icon on mount or when item.icon changes
    useEffect(() => {
        if (!item.icon) {
            setSvgMarkup('');
            return;
        }
        const fetchIcon = async () => {
            try {
                const resp = await fetch(`${apiUrl}/api/getIcon?name=${item.icon}`);
                const data = await resp.json();
                setSvgMarkup(data.svg || '');
            } catch (err) {
                console.error('Error fetching icon for NavItem:', err);
                setSvgMarkup('');
            }
        };
        fetchIcon();
    }, [item.icon]);

    // If user lacks permission for the pageName, do not render
    if (item.pageName && !user?.pages?.includes(item.pageName)) {
        return null;
    }

    // Check if this item is "selected" based on URL match
    const isSelected = !!matchPath({ path: item.url, end: false }, pathname);

    return (
        <ListItemButton
            component={Link}
            to={item.url || '#'}
            selected={isSelected}
            sx={{
                pl: `${level * 24}px`,
                color: isSelected ? theme.palette.primary.main : theme.palette.text.primary,
                '&:hover': {
                    backgroundColor: theme.palette.action.hover
                },
                '&.Mui-selected': {
                    backgroundColor: theme.palette.action.selected,
                    color: theme.palette.primary.main,
                    '& .MuiListItemIcon-root': {
                        color: theme.palette.primary.main
                    },
                    '&:hover': {
                        backgroundColor: theme.palette.action.selected
                    }
                },
                mb: 0.5,
                borderRadius: `${theme.shape.borderRadius}px`
            }}
        >
            <ListItemIcon
                sx={{
                    minWidth: 36,
                    color: isSelected ? theme.palette.primary.main : theme.palette.text.primary
                }}
            >
                {svgMarkup ? (
                    <Box sx={{ width: 20, height: 20 }} dangerouslySetInnerHTML={{ __html: svgMarkup }} />
                ) : (
                    <IconCircle size={20} stroke={1.5} />
                )}
            </ListItemIcon>

            {drawerOpen && (
                <ListItemText
                    primary={
                        <Typography noWrap variant="body1" sx={{ fontWeight: isSelected ? 600 : 400 }}>
                            {item.title}
                        </Typography>
                    }
                />
            )}
        </ListItemButton>
    );
};

NavItem.propTypes = {
    item: PropTypes.shape({
        url: PropTypes.string,
        icon: PropTypes.string,
        title: PropTypes.string,
        pageName: PropTypes.string
    }).isRequired,
    level: PropTypes.number.isRequired,
    drawerOpen: PropTypes.bool
};

export default NavItem;
