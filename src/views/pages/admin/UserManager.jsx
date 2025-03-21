// C:\Users\eliha\firebase\webapp\src\views\pages\admin\UserManager.jsx

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
    Select,
    MenuItem,
    useTheme,
    useMediaQuery,
    CircularProgress
} from '@mui/material';
import { IconSearch, IconUserPlus, IconUserEdit, IconTrash, IconUserOff, IconUserCheck } from '@tabler/icons-react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';

import MainCard from 'ui-component/cards/MainCard';
import useAuth from 'hooks/useAuth';

// A helper to get a color for the user’s role
function getRoleColor(roles, roleId) {
    if (!roleId) return '#888';
    const found = roles.find((r) => (r.id || '').toLowerCase() === (roleId || '').toLowerCase());
    return found?.color || '#888';
}

// Properly capitalize name input
function capitalizeName(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Format phone input: (###) ###-#### while typing
function formatPhoneInput(input) {
    let digits = input.replace(/\D/g, '');
    if (digits.length > 10) digits = digits.slice(0, 10);
    let display = digits;
    if (digits.length > 6) {
        display = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length > 3) {
        display = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else if (digits.length > 0) {
        display = `(${digits}`;
    } else {
        display = '';
    }
    return { digits, display };
}

// Style chip for active/disabled
function getStatusStyle(disabled) {
    return disabled
        ? {
              backgroundColor: '#8B0000',
              color: '#FFB6C1'
          }
        : {
              backgroundColor: '#006400',
              color: '#90EE90'
          };
}

const apiUrl = import.meta.env.VITE_APP_API_URL;

const UserManager = () => {
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const location = useLocation();
    const navigate = useNavigate();

    // 1) from our custom useAuth hook
    const { user } = useAuth();
    const [loadingRoles, setLoadingRoles] = useState(true);
    const [loadingUsers, setLoadingUsers] = useState(true);

    // Track if we have a valid Firebase user to avoid 401s
    const hasValidUser = Boolean(user?.firebaseUser);

    // The lists
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);

    // Filtered users we actually display
    const [filteredUsers, setFilteredUsers] = useState([]);

    // For searching user name
    const [search, setSearch] = useState('');

    // For role filtering
    const [roleFilter, setRoleFilter] = useState('');

    // For add/edit user flow
    const [selectedUser, setSelectedUser] = useState(null);
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);

    // For delete user flow
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // Form data for new/edit user
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: '',
        password: '',
        verifyPassword: '',
        role: ''
    });

    // On mount (and whenever hasValidUser changes):
    useEffect(() => {
        if (!hasValidUser) return;
        // parse ?role= param from URL
        const params = new URLSearchParams(location.search);
        const paramRole = params.get('role') || '';
        setRoleFilter(paramRole.toLowerCase());

        fetchRoles();
        fetchUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasValidUser]);

    // If we do NOT have a valid user yet, or we’re still loading them in the outer AuthGuard, show a spinner
    if (!hasValidUser) {
        return (
            <MainCard>
                <Box sx={{ textAlign: 'center', mt: 4 }}>
                    <CircularProgress />
                    <Typography sx={{ mt: 2 }}>Checking authorization...</Typography>
                </Box>
            </MainCard>
        );
    }

    // Build auth headers
    const getAuthHeaders = async () => {
        const firebaseUser = user?.firebaseUser;
        if (!firebaseUser) {
            console.warn('No firebaseUser found; requests may fail with 401.');
            return {};
        }
        const idToken = await firebaseUser.getIdToken(/* forceRefresh */ true);
        return { Authorization: `Bearer ${idToken}` };
    };

    // Fetch roles
    const fetchRoles = async () => {
        try {
            setLoadingRoles(true);
            const headers = await getAuthHeaders();
            const response = await axios.get(`${apiUrl}/getRoles`, { headers });
            // Ensure we store an array
            setRoles(response.data?.data || []);
        } catch (err) {
            console.error('Error fetching roles:', err);
        } finally {
            setLoadingRoles(false);
        }
    };

    // Fetch users
    const fetchUsers = async () => {
        try {
            setLoadingUsers(true);
            const headers = await getAuthHeaders();
            const response = await axios.get(`${apiUrl}/getUsers`, { headers });
            // Ensure we store an array
            setUsers(response.data?.data || []);
        } catch (err) {
            console.error('Error fetching users:', err);
        } finally {
            setLoadingUsers(false);
        }
    };

    // Once users or roles load, or search/roleFilter changes => apply filters
    useEffect(() => {
        applyFilter();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [users, search, roleFilter, roles]);

    // If roles are loaded => ensure roleFilter is valid, else revert to ""
    useEffect(() => {
        if (!loadingRoles && roles.length > 0 && roleFilter) {
            const validRoleIds = roles.map((r) => r.id.toLowerCase());
            if (!validRoleIds.includes(roleFilter)) {
                setRoleFilter('');
            }
        }
    }, [loadingRoles, roles, roleFilter]);

    const applyFilter = () => {
        let filtered = [...users];

        // Filter by search
        const lowerSearch = search.trim().toLowerCase();
        if (lowerSearch) {
            filtered = filtered.filter((u) => {
                const fullName = (u.firstName + ' ' + u.lastName).toLowerCase();
                const statusText = u.disabled ? 'disabled' : 'active';
                return fullName.includes(lowerSearch) || statusText.includes(lowerSearch);
            });
        }

        // Filter by role if we have one
        if (roleFilter) {
            filtered = filtered.filter((u) => (u.role || '').toLowerCase() === roleFilter);
        }

        setFilteredUsers(filtered);
    };

    // Handle search
    const handleSearch = (e) => {
        setSearch(e.target.value.toLowerCase());
    };

    // Handle role filter
    const handleRoleFilterChange = (e) => {
        const newVal = e.target.value;
        setRoleFilter(newVal);

        // Update ?role= param in URL
        const params = new URLSearchParams(location.search);
        if (newVal) {
            params.set('role', newVal);
        } else {
            params.delete('role');
        }
        navigate({ search: params.toString() }, { replace: true });
    };

    // Add/Edit user
    const openAddEditModal = (userObj = null) => {
        setSelectedUser(userObj);
        if (userObj) {
            // editing
            const rawPhone = userObj.phoneNumber || '';
            let digits = rawPhone.replace(/\D/g, '');
            if (digits.startsWith('1') && digits.length === 11) {
                digits = digits.slice(1);
            }
            const { display } = formatPhoneInput(digits);

            setFormData({
                firstName: userObj.firstName,
                lastName: userObj.lastName,
                email: userObj.email,
                phoneNumber: display,
                password: '',
                verifyPassword: '',
                role: userObj.role || ''
            });
        } else {
            // new
            setFormData({
                firstName: '',
                lastName: '',
                email: '',
                phoneNumber: '',
                password: '',
                verifyPassword: '',
                role: ''
            });
        }
        setIsAddEditModalOpen(true);
    };

    const closeAddEditModal = () => {
        setIsAddEditModalOpen(false);
        setSelectedUser(null);
    };

    const handleSaveUser = async () => {
        try {
            const firstName = capitalizeName(formData.firstName);
            const lastName = capitalizeName(formData.lastName);

            // If creating new user, check password mismatch
            if (!selectedUser && formData.password !== formData.verifyPassword) {
                alert('Passwords do not match!');
                return;
            }

            // Convert phone
            const digits = formData.phoneNumber.replace(/\D/g, '');
            let finalPhone = digits;
            if (digits.length === 10) {
                finalPhone = '+1' + digits;
            }

            const payload = {
                firstName,
                lastName,
                email: formData.email,
                phoneNumber: finalPhone,
                role: formData.role || 'user'
            };

            const headers = await getAuthHeaders();

            if (selectedUser) {
                // Edit existing user
                await axios.post(`${apiUrl}/editUser`, { uid: selectedUser.uid, ...payload }, { headers });
            } else {
                // Create new user
                await axios.post(`${apiUrl}/adminCreateUser`, { ...payload, password: formData.password }, { headers });
            }

            // refresh
            await fetchUsers();
            closeAddEditModal();
        } catch (err) {
            console.error('Error saving user:', err);
            alert(`Error saving user: ${err.message}`);
        }
    };

    // Delete user
    const openDeleteDialog = (userObj) => {
        setSelectedUser(userObj);
        setIsDeleteDialogOpen(true);
    };
    const closeDeleteDialog = () => {
        setSelectedUser(null);
        setIsDeleteDialogOpen(false);
    };
    const handleDeleteUser = async () => {
        try {
            const headers = await getAuthHeaders();
            await axios.post(`${apiUrl}/deleteUser`, { uid: selectedUser.uid }, { headers });
            await fetchUsers();
            closeDeleteDialog();
        } catch (err) {
            console.error('Error deleting user:', err);
            alert(`Error deleting user: ${err.message}`);
        }
    };

    // Toggle status
    const handleToggleStatus = async (userObj) => {
        try {
            const headers = await getAuthHeaders();
            await axios.post(`${apiUrl}/toggleUserStatus`, { uid: userObj.uid, disabled: !userObj.disabled }, { headers });
            await fetchUsers();
        } catch (err) {
            console.error('Error toggling user status:', err);
            alert(`Error toggling user status: ${err.message}`);
        }
    };

    // If we’re still loading roles or users, show a spinner to avoid MUI out-of-range warnings
    if (loadingRoles || loadingUsers) {
        return (
            <MainCard>
                <Box sx={{ textAlign: 'center', mt: 4 }}>
                    <CircularProgress />
                    <Typography sx={{ mt: 2 }}>Loading data...</Typography>
                </Box>
            </MainCard>
        );
    }

    return (
        <MainCard
            title={
                <Grid container alignItems="center" justifyContent="space-between" spacing={2}>
                    <Grid item>
                        <Typography variant="h3">User Manager</Typography>
                    </Grid>
                    <Grid item sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {/* Search Box */}
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

                        {/* Roles DropDown (only now do we have them loaded, so no out-of-range) */}
                        <Select
                            variant="outlined"
                            size="small"
                            value={roleFilter}
                            onChange={handleRoleFilterChange}
                            sx={{ minWidth: 140, mr: 1 }}
                            displayEmpty
                        >
                            <MenuItem value="">All Roles</MenuItem>
                            {roles.map((r) => {
                                const roleColor = r.color || '#888';
                                const initials = (r.id?.[0] || '').toUpperCase();
                                return (
                                    <MenuItem key={r.id} value={r.id.toLowerCase()}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Avatar
                                                sx={{
                                                    bgcolor: roleColor,
                                                    color: '#fff',
                                                    width: 24,
                                                    height: 24,
                                                    fontSize: 14,
                                                    fontWeight: 700
                                                }}
                                            >
                                                {initials}
                                            </Avatar>
                                            <Typography variant="body2">
                                                {r.id
                                                    .split('_')
                                                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                                                    .join(' ')}
                                            </Typography>
                                        </Box>
                                    </MenuItem>
                                );
                            })}
                        </Select>

                        {/* Add User if allowed */}
                        {user?.tables?.users?.includes('Create') && (
                            <Button variant="contained" startIcon={<IconUserPlus />} onClick={() => openAddEditModal()}>
                                Add User
                            </Button>
                        )}
                    </Grid>
                </Grid>
            }
        >
            {/* User Cards */}
            <Grid container spacing={2}>
                {filteredUsers.map((userObj) => {
                    const avatarColor = getRoleColor(roles, userObj.role);
                    const initials = `${userObj.firstName?.[0] || ''}${userObj.lastName?.[0] || ''}`.toUpperCase();
                    const fullName = `${userObj.firstName} ${userObj.lastName}`.trim();

                    return (
                        <Grid item xs={12} sm={6} md={4} lg={3} key={userObj.uid}>
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
                                            bgcolor: avatarColor,
                                            color: '#fff',
                                            width: 56,
                                            height: 56,
                                            fontSize: 24,
                                            fontWeight: 700
                                        }}
                                    >
                                        {initials}
                                    </Avatar>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
                                        {fullName || 'No Name'}
                                    </Typography>
                                    <Box>
                                        <Box
                                            sx={{
                                                display: 'inline-block',
                                                px: 1,
                                                py: 0.5,
                                                borderRadius: 1,
                                                fontSize: '0.75rem',
                                                fontWeight: 'bold',
                                                ...getStatusStyle(userObj.disabled)
                                            }}
                                        >
                                            {userObj.disabled ? 'Disabled' : 'Active'}
                                        </Box>
                                    </Box>
                                </CardContent>
                                <CardActions sx={{ justifyContent: 'center', p: 1 }}>
                                    {/* Edit button (requires Update on users) */}
                                    {user?.tables?.users?.includes('Update') && (
                                        <Tooltip title="Edit User">
                                            <IconButton onClick={() => openAddEditModal(userObj)}>
                                                <IconUserEdit />
                                            </IconButton>
                                        </Tooltip>
                                    )}

                                    {/* Delete button (requires Delete on users) */}
                                    {user?.tables?.users?.includes('Delete') && (
                                        <Tooltip title="Delete User">
                                            <IconButton onClick={() => openDeleteDialog(userObj)}>
                                                <IconTrash />
                                            </IconButton>
                                        </Tooltip>
                                    )}

                                    {/* Toggle status (requires Update on users) */}
                                    {user?.tables?.users?.includes('Update') && (
                                        <Tooltip title={userObj.disabled ? 'Activate User' : 'Suspend User'}>
                                            <IconButton onClick={() => handleToggleStatus(userObj)}>
                                                {userObj.disabled ? <IconUserCheck /> : <IconUserOff />}
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                </CardActions>
                            </Card>
                        </Grid>
                    );
                })}
            </Grid>

            {/* Add/Edit User Modal */}
            <Dialog
                open={isAddEditModalOpen}
                onClose={closeAddEditModal}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: { borderRadius: 3 }
                }}
            >
                <DialogTitle sx={{ pb: 1 }}>{selectedUser ? 'Edit User' : 'Add User'}</DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        First Name
                    </Typography>
                    <TextField
                        fullWidth
                        placeholder="John"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        sx={{ mb: 2 }}
                    />

                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Last Name
                    </Typography>
                    <TextField
                        fullWidth
                        placeholder="Doe"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        sx={{ mb: 2 }}
                    />

                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Email
                    </Typography>
                    <TextField
                        fullWidth
                        placeholder="john@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        sx={{ mb: 2 }}
                    />

                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Phone Number
                    </Typography>
                    <TextField
                        fullWidth
                        placeholder="(000) 000-0000"
                        value={formData.phoneNumber}
                        onChange={(e) => {
                            const { display } = formatPhoneInput(e.target.value);
                            setFormData({ ...formData, phoneNumber: display });
                        }}
                        sx={{ mb: 2 }}
                    />

                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Role
                    </Typography>
                    <Select
                        fullWidth
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        displayEmpty
                        sx={{ mb: 3 }}
                    >
                        <MenuItem value="" disabled>
                            Select Role
                        </MenuItem>
                        {roles.map((r) => {
                            const roleColor = r.color || '#888';
                            const initials = (r.id?.[0] || '').toUpperCase();
                            return (
                                <MenuItem key={r.id} value={r.id}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Avatar
                                            sx={{
                                                bgcolor: roleColor,
                                                color: '#fff',
                                                width: 24,
                                                height: 24,
                                                fontSize: 14,
                                                fontWeight: 700
                                            }}
                                        >
                                            {initials}
                                        </Avatar>
                                        <Typography variant="body2">
                                            {r.id
                                                .split('_')
                                                .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                                                .join(' ')}
                                        </Typography>
                                    </Box>
                                </MenuItem>
                            );
                        })}
                    </Select>

                    {/* If adding new user => show Password/Verify fields */}
                    {!selectedUser && (
                        <>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                Password
                            </Typography>
                            <TextField
                                fullWidth
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                sx={{ mb: 2 }}
                                error={!!formData.password && !!formData.verifyPassword && formData.password !== formData.verifyPassword}
                            />

                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                Verify Password
                            </Typography>
                            <TextField
                                fullWidth
                                type="password"
                                value={formData.verifyPassword}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        verifyPassword: e.target.value
                                    })
                                }
                                sx={{ mb: 1 }}
                                error={!!formData.password && !!formData.verifyPassword && formData.password !== formData.verifyPassword}
                            />
                            {formData.password && formData.verifyPassword && formData.password !== formData.verifyPassword && (
                                <Typography variant="body2" color="error" sx={{ mb: 2 }}>
                                    Passwords do not match
                                </Typography>
                            )}
                        </>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={closeAddEditModal} color="inherit">
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        disabled={
                            !formData.firstName ||
                            !formData.lastName ||
                            !formData.email ||
                            !formData.role ||
                            (!selectedUser && (!formData.password || !formData.verifyPassword))
                        }
                        onClick={handleSaveUser}
                    >
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
                <DialogTitle>Delete User</DialogTitle>
                <DialogContent sx={{ mt: 1 }}>
                    <Typography>
                        Are you sure you want to delete{' '}
                        <strong>
                            {selectedUser?.firstName} {selectedUser?.lastName}
                        </strong>
                        ?
                        <br />
                        This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={closeDeleteDialog} color="inherit">
                        Cancel
                    </Button>
                    <Button variant="contained" color="error" onClick={handleDeleteUser}>
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </MainCard>
    );
};

export default UserManager;
