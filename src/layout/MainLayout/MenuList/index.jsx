// C:\Users\eliha\firebase\webapp\src\views\pages\admin\MenuList.jsx
import React, { memo, useEffect, useState, useCallback } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from 'firebase.js';

// MUI
import { Box, CircularProgress, Divider, IconButton, List, ListSubheader, Paper, Popper, Typography, useTheme } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

// Our NavItem
import NavItem from './NavItem';
// UseAuth to filter items by user.pages
import useAuth from 'hooks/useAuth';

// Add environment-based API URL for fetching group icons
const apiUrl = import.meta.env.VITE_APP_API_URL || '';

function MenuList({ drawerOpen = false }) {
    const theme = useTheme();
    const { user } = useAuth(); // We'll check user.pages to filter menu items

    const [loading, setLoading] = useState(true);

    // menugroups from Firestore
    const [menuGroups, setMenuGroups] = useState([]);
    // Map groupName => group icon SVG
    const [groupIconsMap, setGroupIconsMap] = useState({});

    // groupedMenu => { groupOrder: [...], groupMap: { groupName: [...items] } }
    const [groupedMenu, setGroupedMenu] = useState({ groupOrder: [], groupMap: {} });
    const [expandedGroups, setExpandedGroups] = useState({});
    const [hoveredGroup, setHoveredGroup] = useState(null);
    const [anchorEl, setAnchorEl] = useState(null);

    // ---------------------------
    // (1) Fetch items from "menu" collection, sorted by 'order'
    // ---------------------------
    const fetchMenuItems = useCallback(async () => {
        // This requires a composite index if you have multiple orderBy fields, but here we only do one
        const q_ = query(collection(db, 'menu'), orderBy('order', 'asc'));
        const snap = await getDocs(q_);
        const arr = [];
        snap.forEach((docSnap) => {
            arr.push({ id: docSnap.id, ...docSnap.data() });
        });
        return arr;
    }, []);

    // ---------------------------
    // (2) Build groupMap by menugroups + items
    // ---------------------------
    const buildGroupedMenu = useCallback(
        (groups, allItems) => {
            const groupMap = {};
            const groupOrder = [];

            groups.forEach((grp) => {
                const gName = grp.typeName || 'Misc';

                // Filter items that match this group
                const matching = allItems.filter((it) => (it.type || '').toLowerCase() === gName.toLowerCase());

                // Filter out items if user does not have the page in user.pages
                const allowedItems = matching.filter((item) => {
                    // If item.pageName is missing, allow by default
                    if (!item.pageName) return true;
                    // Otherwise allow only if user.pages has it
                    return user?.pages?.includes(item.pageName);
                });

                groupMap[gName] = allowedItems;
                groupOrder.push(gName);
            });

            setGroupedMenu({ groupOrder, groupMap });

            // Expand only the first group by default
            const initExpanded = {};
            groupOrder.forEach((g, idx) => {
                initExpanded[g] = idx === 0; // only expand the first
            });
            setExpandedGroups(initExpanded);
        },
        [user?.pages]
    );

    // ---------------------------
    // (3) Fetch menugroups + menu items, then build grouped data
    // ---------------------------
    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                // 1) menugroups => sorted by 'order'
                const mgQ = query(collection(db, 'menugroups'), orderBy('order', 'asc'));
                const mgSnap = await getDocs(mgQ);
                const mgArr = [];
                mgSnap.forEach((docSnap) => {
                    mgArr.push({ id: docSnap.id, ...docSnap.data() });
                });
                setMenuGroups(mgArr);

                // 2) menu items
                const itemsArr = await fetchMenuItems();

                // 3) build grouped data
                buildGroupedMenu(mgArr, itemsArr);
            } catch (err) {
                console.error('Error fetching menu data:', err);
            } finally {
                setLoading(false);
            }
        })();
    }, [fetchMenuItems, buildGroupedMenu]);

    // ---------------------------
    // (4) Load group icons => store in groupIconsMap
    // ---------------------------
    const fetchGroupIcons = useCallback(async () => {
        try {
            const tempMap = {};
            for (const grp of menuGroups) {
                const groupIconName = grp.icon || '';
                if (!groupIconName) {
                    tempMap[grp.typeName] = '';
                    continue;
                }
                // Attempt to fetch the icon from our server
                try {
                    const resp = await fetch(`${apiUrl}/api/getIcon?name=${groupIconName}`);
                    const data = await resp.json();
                    tempMap[grp.typeName] = data.svg || '';
                } catch (iconErr) {
                    console.error(`Failed to fetch icon for group '${grp.typeName}':`, iconErr);
                    tempMap[grp.typeName] = '';
                }
            }
            setGroupIconsMap(tempMap);
        } catch (err) {
            console.error('Error in fetchGroupIcons:', err);
        }
    }, [menuGroups]);

    useEffect(() => {
        if (menuGroups.length > 0) {
            fetchGroupIcons();
        }
    }, [menuGroups, fetchGroupIcons]);

    // Expand/Collapse a single group
    const handleToggleGroup = (groupName) => {
        setExpandedGroups((prev) => ({
            ...prev,
            [groupName]: !prev[groupName]
        }));
    };

    // Expand/Collapse ALL groups
    const handleToggleAllGroups = () => {
        // If any group is collapsed, we expand all. Otherwise we collapse all.
        const anyCollapsed = Object.keys(expandedGroups).some((g) => !expandedGroups[g]);
        const newVal = anyCollapsed ? true : false;
        const updated = {};
        Object.keys(expandedGroups).forEach((g) => {
            updated[g] = newVal;
        });
        setExpandedGroups(updated);
    };

    // For minimized drawer: hover events
    const handleGroupMouseEnter = (groupName, event) => {
        setHoveredGroup(groupName);
        setAnchorEl(event.currentTarget);
    };
    const handlePopperMouseLeave = () => {
        setHoveredGroup(null);
        setAnchorEl(null);
    };

    // ---------------------------------------------
    // Render
    // ---------------------------------------------
    if (loading) {
        return <CircularProgress />;
    }

    if (groupedMenu.groupOrder.length === 0) {
        return (
            <Typography variant="body2" sx={{ p: 2 }}>
                No menu items found.
            </Typography>
        );
    }

    return (
        <List
            sx={{
                pt: theme.spacing(2),
                '& .MuiListItem-root': {
                    paddingLeft: theme.spacing(2),
                    paddingRight: theme.spacing(2)
                }
            }}
        >
            {/* Expand/Collapse ALL button, only if drawer is open */}
            {drawerOpen && (
                <ListSubheader
                    sx={{
                        backgroundColor: theme.palette.background.paper,
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderBottom: `1px solid ${theme.palette.divider}`
                    }}
                >
                    <IconButton onClick={handleToggleAllGroups}>
                        {Object.keys(expandedGroups).some((g) => !expandedGroups[g]) ? <AddIcon /> : <RemoveIcon />}
                    </IconButton>
                </ListSubheader>
            )}

            {groupedMenu.groupOrder.map((groupName, idx) => {
                const items = groupedMenu.groupMap[groupName] || [];
                // If user has no items in a group => skip
                if (items.length === 0) {
                    return null;
                }

                const expanded = expandedGroups[groupName];
                const groupSvg = groupIconsMap[groupName] || '';

                return (
                    <React.Fragment key={groupName}>
                        {idx > 0 && (
                            <Box sx={{ my: 1 }}>
                                <Divider />
                            </Box>
                        )}

                        {drawerOpen ? (
                            // ===== Drawer is OPEN => show group name + icon + expand
                            <ListSubheader
                                sx={{
                                    backgroundColor: theme.palette.background.paper,
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    pl: 2,
                                    pr: 2,
                                    height: 48
                                }}
                                onClick={() => handleToggleGroup(groupName)}
                            >
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        flex: 1,
                                        gap: 1
                                    }}
                                >
                                    {groupSvg ? (
                                        <Box
                                            sx={{
                                                width: 20,
                                                height: 20,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                            dangerouslySetInnerHTML={{ __html: groupSvg }}
                                        />
                                    ) : (
                                        <Box sx={{ width: 20, height: 20 }} />
                                    )}
                                    {groupName}
                                </Box>
                                <IconButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleGroup(groupName);
                                    }}
                                >
                                    {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                </IconButton>
                            </ListSubheader>
                        ) : (
                            // ===== Drawer is CLOSED => show icon only, on hover show popper
                            <ListSubheader
                                sx={{
                                    backgroundColor: theme.palette.background.paper,
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    height: 56
                                }}
                                onMouseEnter={(e) => handleGroupMouseEnter(groupName, e)}
                            >
                                {groupSvg ? (
                                    <Box
                                        sx={{
                                            width: 24,
                                            height: 24,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                        dangerouslySetInnerHTML={{ __html: groupSvg }}
                                    />
                                ) : (
                                    <Box sx={{ width: 24, height: 24 }} />
                                )}
                            </ListSubheader>
                        )}

                        {/* If drawer is open & group is expanded => list the items */}
                        {drawerOpen &&
                            expanded &&
                            items.map((item) => <NavItem key={item.id} item={item} level={1} drawerOpen={drawerOpen} />)}
                    </React.Fragment>
                );
            })}

            {/* Popper for hovered group (drawer minimized) */}
            {!drawerOpen && hoveredGroup && (
                <Popper
                    open={Boolean(hoveredGroup)}
                    anchorEl={anchorEl}
                    placement="right-start"
                    sx={{ zIndex: 9999 }}
                    onMouseLeave={handlePopperMouseLeave}
                >
                    <Paper
                        elevation={4}
                        sx={{
                            mt: 1,
                            py: 1,
                            maxHeight: 400,
                            overflow: 'auto'
                        }}
                    >
                        {groupedMenu.groupMap[hoveredGroup]?.map((item) => (
                            <NavItem key={item.id} item={item} level={1} drawerOpen={true} />
                        ))}
                    </Paper>
                </Popper>
            )}
        </List>
    );
}

export default memo(MenuList);
