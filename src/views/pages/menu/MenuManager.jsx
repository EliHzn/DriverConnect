// C:\Users\eliha\firebase\webapp\src\views\pages\menu\MenuManager.jsx

import React, { useEffect, useState, memo, useCallback } from 'react';
import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Typography,
    TextField,
    Paper,
    Snackbar,
    Alert,
    useTheme
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import debounce from 'lodash.debounce';

import { collection, getDocs, doc, setDoc, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from 'firebase.js';

import MainCard from 'ui-component/cards/MainCard';
import { IconTrash, IconEdit } from '@tabler/icons-react';
import useAuth from 'hooks/useAuth';

/**
 * Group items by `type` (group name).
 * Also sorts each group by `order` ascending.
 */
function groupItemsByType(items) {
    // items = [{ type, title, url, order, icon, ... }, ...]
    const groupMap = {};
    const groupNames = new Set();

    items.forEach((itm) => {
        const g = itm.type || 'Misc';
        if (!groupMap[g]) {
            groupMap[g] = [];
        }
        groupMap[g].push(itm);
        groupNames.add(g);
    });

    // Sort items in each group by `order` ascending
    for (const g of Object.keys(groupMap)) {
        groupMap[g].sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    return { groupMap, groupNames: Array.from(groupNames) };
}

const apiUrl = import.meta.env.VITE_APP_API_URL;

function MenuManager() {
    const theme = useTheme();
    const { user } = useAuth();

    // ============= 1) MENUGROUPS STATE + ICONS =============
    const [menuGroups, setMenuGroups] = useState([]); // {id, typeName, icon, order}
    const [groupIconsMap, setGroupIconsMap] = useState({}); // { typeName: "<svg>" }

    // For add/edit group
    const [groupViewerOpen, setGroupViewerOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [groupFormData, setGroupFormData] = useState({
        typeName: '',
        icon: '',
        order: 0
    });

    // For group icon searching
    const [groupIconSearchResults, setGroupIconSearchResults] = useState([]);
    const [groupIconLoading, setGroupIconLoading] = useState(false);
    const debouncedGroupIconSearch = useCallback(
        debounce(async (value) => {
            if (!value) {
                setGroupIconSearchResults([]);
                setGroupIconLoading(false);
                return;
            }
            setGroupIconLoading(true);
            try {
                const resp = await fetch(`${apiUrl}/api/searchIcons?q=${encodeURIComponent(value)}`);
                const data = await resp.json();
                setGroupIconSearchResults(data);
            } catch (err) {
                console.error('Group icon search error:', err);
            } finally {
                setGroupIconLoading(false);
            }
        }, 300),
        []
    );
    // Watch groupFormData.icon => search
    useEffect(() => {
        debouncedGroupIconSearch(groupFormData.icon);
    }, [groupFormData.icon, debouncedGroupIconSearch]);

    // ============= 2) MENU ITEMS STATE + ICONS =============
    const [allItems, setAllItems] = useState([]);
    const [itemIconsMap, setItemIconsMap] = useState({}); // { itemId: "<svg>" }

    const [groupMap, setGroupMap] = useState({}); // { groupName: [menu items...] }
    const [groupNames, setGroupNames] = useState([]);
    const [expandedGroups, setExpandedGroups] = useState({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Add/Edit item
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [formData, setFormData] = useState({
        type: '',
        title: '',
        url: '',
        order: 0,
        icon: ''
    });

    // For item icon searching
    const [itemIconSearchResults, setItemIconSearchResults] = useState([]);
    const [itemIconLoading, setItemIconLoading] = useState(false);
    const debouncedItemIconSearch = useCallback(
        debounce(async (value) => {
            if (!value) {
                setItemIconSearchResults([]);
                setItemIconLoading(false);
                return;
            }
            setItemIconLoading(true);
            try {
                const resp = await fetch(`${apiUrl}/api/searchIcons?q=${encodeURIComponent(value)}`);
                const data = await resp.json();
                setItemIconSearchResults(data);
            } catch (err) {
                console.error('Item icon search error:', err);
            } finally {
                setItemIconLoading(false);
            }
        }, 300),
        []
    );
    useEffect(() => {
        debouncedItemIconSearch(formData.icon);
    }, [formData.icon, debouncedItemIconSearch]);

    // For delete item
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // Notification
    const [notification, setNotification] = useState({
        open: false,
        message: '',
        severity: 'info'
    });

    // ======================= FETCH MENUGROUPS =======================
    async function fetchMenuGroups() {
        try {
            const snap = await getDocs(collection(db, 'menugroups'));
            const arr = [];
            snap.forEach((docSnap) => {
                arr.push({ id: docSnap.id, ...docSnap.data() });
            });
            // Sort menugroups by `order`
            arr.sort((a, b) => (a.order || 0) - (b.order || 0));
            setMenuGroups(arr);

            // Fetch group icons
            const iconsMap = {};
            for (const grp of arr) {
                if (grp.icon) {
                    try {
                        const resp = await fetch(`${apiUrl}/api/getIcon?name=${grp.icon}`);
                        const data = await resp.json();
                        iconsMap[grp.typeName] = data.svg || '';
                    } catch (err) {
                        console.error(`Error fetching group icon for '${grp.typeName}':`, err);
                        iconsMap[grp.typeName] = '';
                    }
                } else {
                    iconsMap[grp.typeName] = '';
                }
            }
            setGroupIconsMap(iconsMap);
        } catch (err) {
            console.error('Error fetching menugroups:', err);
        }
    }

    // ======================= FETCH MENU ITEMS =======================
    async function fetchMenuItems() {
        setLoading(true);
        try {
            // Requires a composite index for multiple orderBys
            const q_ = query(collection(db, 'menu'), orderBy('type', 'asc'), orderBy('order', 'asc'));
            const snap = await getDocs(q_);
            const arr = [];
            snap.forEach((docSnap) => {
                arr.push({ id: docSnap.id, ...docSnap.data() });
            });
            setAllItems(arr);

            // Then fetch item icons
            const iMap = {};
            for (const itm of arr) {
                if (itm.icon) {
                    try {
                        const resp = await fetch(`${apiUrl}/api/getIcon?name=${itm.icon}`);
                        const data = await resp.json();
                        iMap[itm.id] = data.svg || '';
                    } catch (err) {
                        console.error(`Error fetching item icon for '${itm.title}':`, err);
                        iMap[itm.id] = '';
                    }
                } else {
                    iMap[itm.id] = '';
                }
            }
            setItemIconsMap(iMap);

            handleGroupAndFilter(arr, search);
        } catch (err) {
            console.error('Error fetching menu items:', err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchMenuGroups();
        fetchMenuItems();
    }, []);

    // Re-group items whenever `search` changes
    useEffect(() => {
        handleGroupAndFilter(allItems, search);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    function handleGroupAndFilter(items, searchText) {
        const val = searchText.trim().toLowerCase();
        let filtered = items;
        if (val) {
            filtered = items.filter(
                (itm) =>
                    (itm.type || '').toLowerCase().includes(val) ||
                    (itm.title || '').toLowerCase().includes(val) ||
                    (itm.url || '').toLowerCase().includes(val)
            );
        }

        const { groupMap: gMap, groupNames: gNames } = groupItemsByType(filtered);

        // Re-sort group names by menugroups' order
        const sortedGNames = [...gNames].sort((a, b) => {
            const ga = menuGroups.find((x) => x.typeName === a);
            const gb = menuGroups.find((x) => x.typeName === b);
            const oa = ga?.order || 9999;
            const ob = gb?.order || 9999;
            return oa - ob;
        });

        setGroupMap(gMap);
        setGroupNames(sortedGNames);

        // Expand newly discovered groups by default
        const newExp = { ...expandedGroups };
        sortedGNames.forEach((g) => {
            if (newExp[g] === undefined) {
                newExp[g] = true;
            }
        });
        setExpandedGroups(newExp);
    }

    // ======================= GROUP ADD/EDIT/DELETE =======================
    const openGroupEditDialog = (grp = null) => {
        setSelectedGroup(grp);
        if (grp) {
            setGroupFormData({
                typeName: grp.typeName,
                icon: grp.icon || '',
                order: grp.order || 0
            });
        } else {
            setGroupFormData({ typeName: '', icon: '', order: 0 });
        }
        setGroupViewerOpen(true);
    };

    const closeGroupViewer = () => {
        setGroupViewerOpen(false);
        setSelectedGroup(null);
        setGroupFormData({ typeName: '', icon: '', order: 0 });
    };

    async function handleSaveGroup() {
        try {
            const { typeName, icon, order } = groupFormData;
            const trimmed = typeName.trim();
            if (!trimmed) {
                alert('Group name is required.');
                return;
            }
            if (selectedGroup) {
                // Update => must have "Update" menugroups
                if (!user?.tables?.menugroups?.includes('Update')) {
                    alert('No permission to update menugroups!');
                    return;
                }
                await updateDoc(doc(db, 'menugroups', selectedGroup.typeName), {
                    typeName: trimmed,
                    icon: icon.trim(),
                    order: Number(order) || 0
                });
            } else {
                // Create => must have "Create" menugroups
                if (!user?.tables?.menugroups?.includes('Create')) {
                    alert('No permission to create menugroups!');
                    return;
                }
                await setDoc(doc(db, 'menugroups', trimmed), {
                    typeName: trimmed,
                    icon: icon.trim(),
                    order: Number(order) || 0
                });
            }
            closeGroupViewer();
            fetchMenuGroups();
            setNotification({
                open: true,
                message: 'Group saved successfully!',
                severity: 'success'
            });
        } catch (err) {
            console.error('Error saving group:', err);
            setNotification({
                open: true,
                message: 'Failed to save group.',
                severity: 'error'
            });
        }
    }

    async function handleDeleteGroup(grp) {
        if (!grp) return;
        if (!user?.tables?.menugroups?.includes('Delete')) {
            alert('No permission to delete groups!');
            return;
        }
        try {
            await deleteDoc(doc(db, 'menugroups', grp.typeName));
            fetchMenuGroups();
            setNotification({
                open: true,
                message: 'Group deleted successfully!',
                severity: 'success'
            });
        } catch (err) {
            console.error('Error deleting group:', err);
            setNotification({
                open: true,
                message: 'Failed to delete group.',
                severity: 'error'
            });
        }
    }

    // ======================= ITEM ADD/EDIT/DELETE =======================
    const openAddEditModal = (item = null) => {
        setSelectedItem(item);
        if (item) {
            setFormData({
                type: item.type || '',
                title: item.title || '',
                url: item.url || '',
                order: item.order || 0,
                icon: item.icon || ''
            });
        } else {
            setFormData({ type: '', title: '', url: '', order: 0, icon: '' });
        }
        setIsAddEditModalOpen(true);
    };
    const closeAddEditModal = () => {
        setIsAddEditModalOpen(false);
        setSelectedItem(null);
    };

    async function handleSaveItem() {
        try {
            if (!formData.type.trim() || !formData.title.trim()) {
                alert('Group (type) and title are required!');
                return;
            }
            if (selectedItem) {
                // update => "Update" menu
                if (!user?.tables?.menu?.includes('Update')) {
                    alert('No permission to update menu items!');
                    return;
                }
                await updateDoc(doc(db, 'menu', selectedItem.id), {
                    type: formData.type.trim(),
                    title: formData.title.trim(),
                    url: formData.url.trim(),
                    order: Number(formData.order) || 0,
                    icon: formData.icon.trim()
                });
            } else {
                // create => "Create" menu
                if (!user?.tables?.menu?.includes('Create')) {
                    alert('No permission to create menu items!');
                    return;
                }
                await addDoc(collection(db, 'menu'), {
                    type: formData.type.trim(),
                    title: formData.title.trim(),
                    url: formData.url.trim(),
                    order: Number(formData.order) || 0,
                    icon: formData.icon.trim()
                });
            }
            closeAddEditModal();
            fetchMenuItems();
        } catch (err) {
            console.error('Error saving menu item:', err);
            alert(`Error saving item: ${err.message}`);
        }
    }

    const openDeleteDialog = (item) => {
        if (!user?.tables?.menu?.includes('Delete')) {
            alert('No permission to delete menu items!');
            return;
        }
        setSelectedItem(item);
        setIsDeleteDialogOpen(true);
    };
    const closeDeleteDialog = () => {
        setIsDeleteDialogOpen(false);
        setSelectedItem(null);
    };
    async function handleDeleteItem() {
        if (!selectedItem) return;
        try {
            await deleteDoc(doc(db, 'menu', selectedItem.id));
            closeDeleteDialog();
            fetchMenuItems();
        } catch (err) {
            console.error('Error deleting menu item:', err);
            alert(`Error deleting item: ${err.message}`);
        }
    }

    // ======================= RENDER =======================
    if (loading) return <CircularProgress />;

    return (
        <MainCard title="Menu Manager">
            {/* Notifications */}
            <Snackbar open={notification.open} autoHideDuration={6000} onClose={() => setNotification({ ...notification, open: false })}>
                <Alert onClose={() => setNotification({ ...notification, open: false })} severity={notification.severity}>
                    {notification.message}
                </Alert>
            </Snackbar>

            {/* Top controls: search + "Add Menu Item" */}
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                {/* Search box */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 1,
                        pl: 1,
                        pr: 1
                    }}
                >
                    <SearchIcon color="action" sx={{ mr: 0.5 }} />
                    <TextField
                        variant="standard"
                        placeholder="Search..."
                        onChange={(e) => setSearch(e.target.value)}
                        InputProps={{ disableUnderline: true }}
                        sx={{ width: 120 }}
                    />
                </Box>

                {/* If user can "Create" menu, show "Add Menu Item" */}
                {user?.tables?.menu?.includes('Create') && (
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => openAddEditModal()}>
                        Add Menu Item
                    </Button>
                )}
            </Box>

            {/* Group Viewer: Add/Edit/Delete groups */}
            <Box sx={{ mb: 3, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                    Group Viewer
                </Typography>

                {/* Add Group (if user can "Create" menugroups) */}
                {user?.tables?.menugroups?.includes('Create') && (
                    <Button variant="contained" startIcon={<AddIcon />} sx={{ mb: 2 }} onClick={() => openGroupEditDialog(null)}>
                        Add Group
                    </Button>
                )}

                {menuGroups.length === 0 ? (
                    <Typography variant="body2">No groups found.</Typography>
                ) : (
                    menuGroups.map((grp) => {
                        const svg = groupIconsMap[grp.typeName] || '';
                        return (
                            <Paper
                                key={grp.typeName}
                                sx={{
                                    p: 1,
                                    mb: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}
                            >
                                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                        {/* Display actual group icon */}
                                        {svg && <Box sx={{ width: 24, height: 24 }} dangerouslySetInnerHTML={{ __html: svg }} />}
                                        <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                                            {grp.typeName} (order: {grp.order})
                                        </Typography>
                                    </Box>
                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                        Icon: {grp.icon || '(none)'}
                                    </Typography>
                                </Box>
                                <Box>
                                    {/* Edit group => "Update" menugroups */}
                                    {user?.tables?.menugroups?.includes('Update') && (
                                        <IconButton size="small" sx={{ mr: 1 }} onClick={() => openGroupEditDialog(grp)}>
                                            <IconEdit size={16} stroke={1.5} />
                                        </IconButton>
                                    )}
                                    {/* Delete group => "Delete" menugroups */}
                                    {user?.tables?.menugroups?.includes('Delete') && (
                                        <IconButton size="small" onClick={() => handleDeleteGroup(grp)}>
                                            {/* Gray icon (no color="error") */}
                                            <IconTrash size={16} stroke={1.5} />
                                        </IconButton>
                                    )}
                                </Box>
                            </Paper>
                        );
                    })
                )}
            </Box>

            {/* Now display the grouped menu items */}
            {groupNames.length === 0 ? (
                <Typography variant="body2">No menu items found.</Typography>
            ) : (
                groupNames.map((gName) => {
                    const items = groupMap[gName] || [];
                    const expanded = expandedGroups[gName];

                    return (
                        <Box key={gName} sx={{ mt: 3 }}>
                            <Paper
                                elevation={1}
                                sx={{
                                    cursor: 'pointer',
                                    p: 1.5,
                                    borderRadius: 1,
                                    backgroundColor: theme.palette.action.hover,
                                    '&:hover': {
                                        backgroundColor: theme.palette.action.focus
                                    },
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}
                                onClick={() =>
                                    setExpandedGroups((prev) => ({
                                        ...prev,
                                        [gName]: !prev[gName]
                                    }))
                                }
                            >
                                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                    {gName}
                                </Typography>
                                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </Paper>
                            {expanded && (
                                <Box sx={{ mt: 1, ml: 2 }}>
                                    {items.length === 0 ? (
                                        <Typography variant="body2">No items in this group.</Typography>
                                    ) : (
                                        items.map((item) => {
                                            // Retrieve the item’s actual SVG from itemIconsMap
                                            const iSvg = itemIconsMap[item.id] || '';
                                            return (
                                                <Paper
                                                    key={item.id}
                                                    sx={{
                                                        p: 1.5,
                                                        mb: 1,
                                                        border: `1px solid ${theme.palette.divider}`,
                                                        borderRadius: 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        transition: 'box-shadow 0.2s',
                                                        '&:hover': {
                                                            boxShadow: theme.shadows[2]
                                                        }
                                                    }}
                                                >
                                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                                        {/* Actual item icon if present */}
                                                        {iSvg && (
                                                            <Box
                                                                sx={{ width: 24, height: 24 }}
                                                                dangerouslySetInnerHTML={{ __html: iSvg }}
                                                            />
                                                        )}
                                                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                            {item.title} (order: {item.order})
                                                        </Typography>
                                                    </Box>
                                                    <Box>
                                                        {/* Edit => "Update" on menu */}
                                                        {user?.tables?.menu?.includes('Update') && (
                                                            <IconButton size="small" onClick={() => openAddEditModal(item)} sx={{ mr: 1 }}>
                                                                <IconEdit size={16} stroke={1.5} />
                                                            </IconButton>
                                                        )}
                                                        {/* Delete => "Delete" on menu */}
                                                        {user?.tables?.menu?.includes('Delete') && (
                                                            <IconButton size="small" onClick={() => openDeleteDialog(item)}>
                                                                {/* Gray icon */}
                                                                <IconTrash size={16} stroke={1.5} />
                                                            </IconButton>
                                                        )}
                                                    </Box>
                                                </Paper>
                                            );
                                        })
                                    )}
                                </Box>
                            )}
                        </Box>
                    );
                })
            )}

            {/* Group Add/Edit Dialog */}
            <Dialog open={groupViewerOpen} onClose={closeGroupViewer} maxWidth="xs" fullWidth>
                <DialogTitle>{selectedGroup ? 'Edit Group' : 'Add Group'}</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        label="Group Name"
                        variant="standard"
                        value={groupFormData.typeName}
                        onChange={(e) => setGroupFormData((prev) => ({ ...prev, typeName: e.target.value }))}
                        sx={{ mb: 2 }}
                        disabled={!!selectedGroup}
                    />

                    {/* Group icon search */}
                    <Autocomplete
                        freeSolo
                        loading={groupIconLoading}
                        options={groupIconSearchResults.map((o) => o.name)}
                        value={groupFormData.icon}
                        onInputChange={(e, val) => setGroupFormData((prev) => ({ ...prev, icon: val }))}
                        onChange={(e, val) => setGroupFormData((prev) => ({ ...prev, icon: val || '' }))}
                        renderOption={(props, optionName) => {
                            const found = groupIconSearchResults.find((x) => x.name === optionName);
                            return (
                                <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center' }}>
                                    {found && <Box sx={{ width: 24, height: 24, mr: 1 }} dangerouslySetInnerHTML={{ __html: found.svg }} />}
                                    {optionName}
                                </Box>
                            );
                        }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                variant="standard"
                                label="Group Icon"
                                placeholder="Search icons..."
                                sx={{ mb: 2 }}
                                InputProps={{
                                    ...params.InputProps,
                                    endAdornment: (
                                        <>
                                            {groupIconLoading ? <CircularProgress size={20} /> : null}
                                            {params.InputProps.endAdornment}
                                        </>
                                    )
                                }}
                            />
                        )}
                    />

                    <TextField
                        fullWidth
                        label="Group Order"
                        variant="standard"
                        type="number"
                        value={groupFormData.order}
                        onChange={(e) =>
                            setGroupFormData((prev) => ({
                                ...prev,
                                order: Number(e.target.value) || 0
                            }))
                        }
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeGroupViewer} color="inherit">
                        Cancel
                    </Button>
                    <Button variant="contained" onClick={handleSaveGroup}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Add/Edit Menu Item Dialog */}
            <Dialog open={isAddEditModalOpen} onClose={closeAddEditModal} maxWidth="sm" fullWidth>
                <DialogTitle>{selectedItem ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        label="Group (type)"
                        variant="standard"
                        value={formData.type}
                        onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value }))}
                        sx={{ mb: 2, mt: 1 }}
                    />
                    <TextField
                        fullWidth
                        label="Title"
                        variant="standard"
                        value={formData.title}
                        onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        fullWidth
                        label="URL"
                        variant="standard"
                        value={formData.url}
                        onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        fullWidth
                        label="Order"
                        variant="standard"
                        type="number"
                        value={formData.order}
                        onChange={(e) =>
                            setFormData((prev) => ({
                                ...prev,
                                order: Number(e.target.value) || 0
                            }))
                        }
                        sx={{ mb: 2 }}
                    />

                    {/* Item Icon Search */}
                    <Autocomplete
                        freeSolo
                        loading={itemIconLoading}
                        options={itemIconSearchResults.map((ic) => ic.name)}
                        value={formData.icon}
                        onInputChange={(e, val) => setFormData((prev) => ({ ...prev, icon: val }))}
                        onChange={(e, val) => setFormData((prev) => ({ ...prev, icon: val || '' }))}
                        renderOption={(props, optionName) => {
                            const found = itemIconSearchResults.find((o) => o.name === optionName);
                            return (
                                <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center' }}>
                                    {found && <Box sx={{ width: 24, height: 24, mr: 1 }} dangerouslySetInnerHTML={{ __html: found.svg }} />}
                                    {optionName}
                                </Box>
                            );
                        }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                variant="standard"
                                label="Item Icon"
                                placeholder="Search icons..."
                                InputProps={{
                                    ...params.InputProps,
                                    endAdornment: (
                                        <>
                                            {itemIconLoading ? <CircularProgress size={20} /> : null}
                                            {params.InputProps.endAdornment}
                                        </>
                                    )
                                }}
                            />
                        )}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeAddEditModal} color="inherit">
                        Cancel
                    </Button>
                    <Button variant="contained" onClick={handleSaveItem}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onClose={closeDeleteDialog} maxWidth="xs">
                <DialogTitle>Delete Menu Item</DialogTitle>
                <DialogContent>
                    Are you sure you want to delete <strong>{selectedItem?.title}</strong>?
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDeleteDialog} color="inherit">
                        Cancel
                    </Button>
                    <Button variant="contained" onClick={handleDeleteItem}>
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </MainCard>
    );
}

export default memo(MenuManager);
