// C:\Users\eliha\firebase\webapp\src\views\pages\admin\RoleManager.jsx

import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    Grid,
    InputAdornment,
    Typography,
    Card,
    CardContent,
    CardActions,
    Avatar,
    Tooltip,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Checkbox,
    FormControlLabel,
    useTheme,
    useMediaQuery
} from '@mui/material';
import { Autocomplete } from '@mui/material';
import { IconSearch, IconUserPlus, IconUserEdit, IconTrash, IconUserQuestion } from '@tabler/icons-react'; // <-- Import the IconUserQuestion
import axios from 'axios';

import MainCard from 'ui-component/cards/MainCard';
import useAuth from 'hooks/useAuth';

const apiUrl = import.meta.env.VITE_APP_API_URL;

// Table perms: "Read", "Create", "Update", "Delete"
const POSSIBLE_PERMS = ['Read', 'Create', 'Update', 'Delete'];

/** "super_admin1" => "Super Admin" */
function formatRoleName(roleId) {
    if (!roleId) return '';
    return roleId
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

const RoleManager = () => {
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

    // Access user => for tables.roles checks & firebaseUser for ID tokens
    const { user } = useAuth();

    // Shortcuts for permission checks
    const canCreate = user?.tables?.roles?.includes('Create');
    const canUpdate = user?.tables?.roles?.includes('Update');
    const canDelete = user?.tables?.roles?.includes('Delete');

    // Helper to build Authorization headers
    const getAuthHeaders = async () => {
        const firebaseUser = user?.firebaseUser;
        if (!firebaseUser) {
            console.warn('No firebaseUser found. Requests may fail with 401.');
            return {};
        }
        const idToken = await firebaseUser.getIdToken(/* forceRefresh */ true);
        return { Authorization: `Bearer ${idToken}` };
    };

    // Data sets
    const [roles, setRoles] = useState([]);
    const [filteredRoles, setFilteredRoles] = useState([]);
    const [search, setSearch] = useState('');
    const [users, setUsers] = useState([]);

    // Pages + Tables
    const [availablePages, setAvailablePages] = useState([]);
    const [availableTables, setAvailableTables] = useState([]);

    // Role editing/deletion
    const [selectedRole, setSelectedRole] = useState(null);

    // Add/Edit modal
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Delete modal
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [hasUsersAssigned, setHasUsersAssigned] = useState(false);
    const [userCount, setUserCount] = useState(0);

    // Form data for new/edit
    const [formData, setFormData] = useState({
        id: '',
        color: '#666',
        pages: [],
        tables: {}
    });

    // --- Lifecycle: fetch all data on mount ---
    useEffect(() => {
        fetchAllData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchAllData = async () => {
        try {
            await fetchRoles();
            await fetchUsers();
            await fetchCollections();
        } catch (error) {
            console.error('Error in fetchAllData:', error);
            alert(`Error loading data: ${error.message}`);
        }
    };

    const fetchRoles = async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await axios.get(`${apiUrl}/getRoles`, { headers });
            setRoles(res.data.data || []);
            setFilteredRoles(res.data.data || []);
        } catch (err) {
            console.error('Error fetching roles:', err);
            alert(`Error fetching roles: ${err.message}`);
        }
    };

    const fetchUsers = async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await axios.get(`${apiUrl}/getUsers`, { headers });
            setUsers(res.data.data || []);
        } catch (err) {
            console.error('Error fetching users:', err);
            alert(`Error fetching users: ${err.message}`);
        }
    };

    const fetchCollections = async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await axios.get(`${apiUrl}/getAllCollections`, { headers });

            setAvailablePages(res.data.pages || []);
            setAvailableTables(res.data.tables || []);
        } catch (err) {
            console.error('Error fetching collection names:', err);
            alert(`Error fetching collections: ${err.message}`);

            // Fallback if we can't load from server:
            setAvailablePages(['login', 'dashboard']);
            setAvailableTables(['menu', 'roles', 'users']);
        }
    };

    // Searching roles
    const handleSearch = (e) => {
        const value = e.target.value.toLowerCase();
        setSearch(value);
        const filtered = roles.filter((r) => (r.id || '').toLowerCase().includes(value));
        setFilteredRoles(filtered);
    };

    // Count how many users assigned to a role
    const getUserCountForRole = (roleId) => {
        return users.filter((u) => (u.role || '').toLowerCase() === roleId.toLowerCase()).length;
    };

    // Open Add/Edit
    const openModal = (role = null) => {
        // If trying to add a new role but no "Create" permission
        if (!role && !canCreate) {
            alert('You do not have permission to create roles.');
            return;
        }
        // If trying to edit a role but no "Update" permission
        if (role && !canUpdate) {
            alert('You do not have permission to update roles.');
            return;
        }
        // block editing super_admin1
        if (role && role.id === 'super_admin1') {
            alert('Super Admin role cannot be edited.');
            return;
        }

        setSelectedRole(role);
        if (role) {
            setFormData({
                id: role.id || '',
                color: role.color || '#666',
                pages: Array.isArray(role.pages) ? role.pages : [],
                tables: typeof role.tables === 'object' ? role.tables : {}
            });
        } else {
            setFormData({
                id: '',
                color: '#666',
                pages: [],
                tables: {}
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedRole(null);
    };

    const handleSaveRole = async () => {
        try {
            // Basic validation
            if (!formData.id.trim()) {
                alert('Role ID is required.');
                return;
            }
            // block creating super_admin1
            if (!selectedRole && formData.id.toLowerCase() === 'super_admin1') {
                alert('Cannot create a super_admin1 role. It already exists.');
                return;
            }

            // Build payload
            const payload = {
                id: formData.id.trim(),
                color: formData.color.trim(),
                pages: formData.pages,
                tables: formData.tables
            };

            const headers = await getAuthHeaders();

            if (selectedRole) {
                // Updating
                if (!canUpdate) {
                    alert('You do not have permission to update roles.');
                    return;
                }
                await axios.post(
                    `${apiUrl}/editRole`,
                    {
                        oldId: selectedRole.id,
                        ...payload
                    },
                    { headers }
                );
            } else {
                // Creating
                if (!canCreate) {
                    alert('You do not have permission to create roles.');
                    return;
                }
                await axios.post(`${apiUrl}/createRole`, payload, { headers });
            }

            await fetchRoles();
            closeModal();
        } catch (error) {
            console.error('Error saving role:', error);
            alert(`Error saving role: ${error.message}`);
        }
    };

    // Delete
    const openDeleteDialog = (role) => {
        // If no "Delete" permission
        if (!canDelete) {
            alert('You do not have permission to delete roles.');
            return;
        }
        if (role.id === 'super_admin1') {
            alert('Cannot delete the Super Admin role.');
            return;
        }

        setSelectedRole(role);

        const count = getUserCountForRole(role.id);
        setUserCount(count);
        setHasUsersAssigned(count > 0);

        setIsDeleteDialogOpen(true);
    };

    const closeDeleteDialog = () => {
        setSelectedRole(null);
        setIsDeleteDialogOpen(false);
    };

    const handleDeleteRole = async () => {
        try {
            if (hasUsersAssigned) {
                return;
            }
            if (!canDelete) {
                alert('You do not have permission to delete roles.');
                return;
            }
            const headers = await getAuthHeaders();
            await axios.post(`${apiUrl}/deleteRole`, { id: selectedRole.id }, { headers });
            await fetchRoles();
            closeDeleteDialog();
        } catch (error) {
            console.error('Error deleting role:', error);
            alert(`Error deleting role: ${error.message}`);
        }
    };

    // Toggle table perms
    const toggleTablePermission = (tableName, perm) => {
        const newTables = { ...formData.tables };
        const currentPerms = Array.isArray(newTables[tableName]) ? [...newTables[tableName]] : [];
        const idx = currentPerms.indexOf(perm);
        if (idx > -1) {
            currentPerms.splice(idx, 1);
        } else {
            currentPerms.push(perm);
        }
        newTables[tableName] = currentPerms;
        setFormData({ ...formData, tables: newTables });
    };

    return (
        <MainCard
            title={
                <Grid container alignItems="center" justifyContent="space-between" spacing={2}>
                    <Grid item>
                        <Typography variant="h3">Role Manager</Typography>
                    </Grid>
                    <Grid item>
                        <TextField
                            variant="outlined"
                            size="small"
                            placeholder="Search"
                            value={search}
                            onChange={handleSearch}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <IconSearch stroke={1.5} size="16px" />
                                    </InputAdornment>
                                )
                            }}
                            sx={{ mr: 1 }}
                        />
                        {canCreate && (
                            <Button variant="contained" startIcon={<IconUserPlus />} onClick={() => openModal()}>
                                Add Role
                            </Button>
                        )}
                    </Grid>
                </Grid>
            }
        >
            <Grid container spacing={2}>
                {filteredRoles.map((role) => {
                    const userCountForThisRole = getUserCountForRole(role.id);
                    return (
                        <Grid item xs={12} sm={6} md={4} lg={3} key={role.id}>
                            <Card
                                sx={{
                                    borderRadius: 2,
                                    overflow: 'hidden',
                                    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                                    '&:hover': {
                                        boxShadow: theme.shadows[4],
                                        transform: 'translateY(-2px)'
                                    }
                                }}
                            >
                                <CardContent
                                    sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: 1,
                                        p: 2
                                    }}
                                >
                                    <Avatar
                                        sx={{
                                            bgcolor: role.color || '#666',
                                            color: '#fff',
                                            width: 56,
                                            height: 56,
                                            fontSize: 24,
                                            fontWeight: 700
                                        }}
                                    >
                                        {role.id?.[0]?.toUpperCase() || '?'}
                                    </Avatar>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
                                        {formatRoleName(role.id)}
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center' }}>
                                        {userCountForThisRole} {userCountForThisRole === 1 ? 'user' : 'users'}
                                    </Typography>
                                </CardContent>
                                <CardActions sx={{ justifyContent: 'center', p: 1 }}>
                                    {/* Edit button */}
                                    {role.id === 'super_admin1' ? (
                                        <Tooltip title="Cannot edit super admin">
                                            <span>
                                                <IconButton disabled>
                                                    <IconUserEdit />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                    ) : canUpdate ? (
                                        <Tooltip title="Edit Role">
                                            <IconButton onClick={() => openModal(role)}>
                                                <IconUserEdit />
                                            </IconButton>
                                        </Tooltip>
                                    ) : null}

                                    {/* View Users button (IconUserQuestion) */}
                                    <Tooltip title="View Users">
                                        <IconButton
                                            component="a"
                                            href={`http://localhost:3000/user-manager?role=${role.id.toLowerCase()}`}
                                            sx={{ color: 'inherit' }}
                                        >
                                            <IconUserQuestion stroke={1.5} />
                                        </IconButton>
                                    </Tooltip>

                                    {/* Delete button */}
                                    {role.id === 'super_admin1' ? (
                                        <Tooltip title="Cannot delete super admin">
                                            <span>
                                                <IconButton disabled>
                                                    <IconTrash />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                    ) : canDelete ? (
                                        <Tooltip title="Delete Role">
                                            <IconButton onClick={() => openDeleteDialog(role)}>
                                                <IconTrash />
                                            </IconButton>
                                        </Tooltip>
                                    ) : null}
                                </CardActions>
                            </Card>
                        </Grid>
                    );
                })}
            </Grid>

            {/* Add/Edit Role Modal */}
            <Dialog
                open={isModalOpen}
                onClose={closeModal}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: { borderRadius: 3 }
                }}
            >
                <DialogTitle sx={{ pb: 1 }}>{selectedRole ? 'Edit Role' : 'Add Role'}</DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Role ID
                    </Typography>
                    <TextField
                        fullWidth
                        placeholder="ex: admin or manager"
                        value={formData.id}
                        onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                        disabled={!!selectedRole} // can't change ID if editing
                        sx={{ mb: 2 }}
                    />

                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Role Color
                    </Typography>
                    <TextField
                        type="color"
                        fullWidth
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        sx={{ mb: 2, height: 42 }}
                    />

                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Pages
                    </Typography>
                    <Autocomplete
                        multiple
                        options={availablePages}
                        value={Array.isArray(formData.pages) ? formData.pages : []}
                        onChange={(event, newValue) => {
                            setFormData({ ...formData, pages: newValue });
                        }}
                        renderInput={(params) => <TextField {...params} placeholder="Select pages..." />}
                        sx={{ mb: 3 }}
                    />

                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Tables (Permissions)
                    </Typography>
                    {availableTables.length === 0 ? (
                        <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                            No table names found.
                        </Typography>
                    ) : (
                        availableTables.map((tableName) => {
                            const currentPerms = Array.isArray(formData.tables[tableName]) ? formData.tables[tableName] : [];
                            return (
                                <Box
                                    key={tableName}
                                    sx={{
                                        mb: 2,
                                        border: '1px solid #ccc',
                                        borderRadius: 1,
                                        p: 1
                                    }}
                                >
                                    <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                                        {tableName.toUpperCase()}
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                        {POSSIBLE_PERMS.map((perm) => {
                                            const checked = currentPerms.includes(perm);
                                            return (
                                                <FormControlLabel
                                                    key={perm}
                                                    control={
                                                        <Checkbox
                                                            checked={checked}
                                                            onChange={() => toggleTablePermission(tableName, perm)}
                                                        />
                                                    }
                                                    label={perm}
                                                />
                                            );
                                        })}
                                    </Box>
                                </Box>
                            );
                        })
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={closeModal} color="inherit">
                        Cancel
                    </Button>
                    <Button variant="contained" disabled={!formData.id.trim()} onClick={handleSaveRole}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={isDeleteDialogOpen}
                onClose={closeDeleteDialog}
                maxWidth="xs"
                fullWidth
                PaperProps={{
                    sx: { borderRadius: 3 }
                }}
            >
                <DialogTitle>Delete Role</DialogTitle>
                <DialogContent sx={{ mt: 1 }}>
                    {hasUsersAssigned ? (
                        <Typography color="error">
                            There are currently {userCount} user
                            {userCount !== 1 && 's'} assigned to the role {formatRoleName(selectedRole?.id)}. You must first reassign those
                            user{userCount !== 1 && 's'} to another role before deleting.
                        </Typography>
                    ) : (
                        <Typography>
                            Once a Role is deleted it cannot be recovered.
                            <br />
                            <strong>Are you sure you want to delete it?</strong>
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={closeDeleteDialog} color="inherit">
                        Cancel
                    </Button>
                    <Button variant="contained" color="error" onClick={handleDeleteRole} disabled={hasUsersAssigned}>
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </MainCard>
    );
};

export default RoleManager;
