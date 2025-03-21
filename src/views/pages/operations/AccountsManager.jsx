// C:\Users\eliha\firebase\webapp\src\views\pages\operations\AccountsManager.jsx

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
    Tooltip,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    useTheme,
    useMediaQuery
} from '@mui/material';
import {
    IconSearch,
    IconBuildingSkyscraper,
    IconTrash,
    IconEye,
    IconPower // For activating/suspending
} from '@tabler/icons-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

import MainCard from 'ui-component/cards/MainCard';
import useAuth from 'hooks/useAuth';

/** Format phone as (###) ###-####. */
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

/** A small helper to style an 'Active' vs 'Disabled' chip below the account name. */
function getStatusStyle(isActive) {
    if (isActive) {
        return {
            backgroundColor: '#006400',
            color: '#90EE90'
        };
    } else {
        return {
            backgroundColor: '#8B0000',
            color: '#FFB6C1'
        };
    }
}

const apiUrl = import.meta.env.VITE_APP_API_URL;

const AccountsManager = () => {
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const navigate = useNavigate();

    const { user } = useAuth();

    // Build headers with current user’s ID token
    const getAuthHeaders = async () => {
        const firebaseUser = user?.firebaseUser;
        if (!firebaseUser) {
            console.warn('No firebaseUser found; requests may fail with 401.');
            return {};
        }
        const idToken = await firebaseUser.getIdToken(/* forceRefresh */ true);
        return { Authorization: `Bearer ${idToken}` };
    };

    // States
    const [accounts, setAccounts] = useState([]);
    const [filteredAccounts, setFilteredAccounts] = useState([]);
    const [search, setSearch] = useState('');

    // Add-Only modal (no main editing from the list)
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        phone: ''
    });

    // Delete dialog
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // Fetch on mount
    useEffect(() => {
        fetchAccounts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchAccounts = async () => {
        try {
            const headers = await getAuthHeaders();
            const resp = await axios.get(`${apiUrl}/getAccounts`, { headers });
            const all = resp.data.data || [];
            setAccounts(all);
            setFilteredAccounts(all);
        } catch (err) {
            console.error('Error fetching accounts:', err);
        }
    };

    // Search filter
    const handleSearch = (e) => {
        const value = e.target.value.toLowerCase();
        setSearch(value);
        const newFiltered = accounts.filter((acc) => {
            return acc.name?.toLowerCase().includes(value) || acc.city?.toLowerCase().includes(value) || acc.phone?.includes(value);
        });
        setFilteredAccounts(newFiltered);
    };

    // -------------------- Add (New) Account Flow --------------------
    const openAddModal = () => {
        // Clear form => user is adding
        setFormData({
            name: '',
            address: '',
            city: '',
            state: '',
            zip: '',
            phone: ''
        });
        setIsAddEditModalOpen(true);
    };

    const closeAddModal = () => {
        setIsAddEditModalOpen(false);
    };

    const handleSaveAccount = async () => {
        try {
            // We'll do createAccount only
            const payload = {
                name: formData.name.trim(),
                address: formData.address.trim(),
                city: formData.city.trim(),
                state: formData.state.trim(),
                zip: formData.zip.trim()
            };
            // Convert phone
            const digits = formData.phone.replace(/\D/g, '');
            let finalPhone = digits.length === 10 ? '+1' + digits : digits;
            payload.phone = finalPhone;

            const headers = await getAuthHeaders();
            await axios.post(`${apiUrl}/createAccount`, payload, { headers });

            closeAddModal();
            fetchAccounts();
        } catch (err) {
            console.error('Error saving account:', err);
            alert(`Error saving account: ${err.message}`);
        }
    };

    // -------------------- Delete Account Flow --------------------
    const openDeleteDialog = (account) => {
        setSelectedAccount(account);
        setIsDeleteDialogOpen(true);
    };
    const closeDeleteDialog = () => {
        setSelectedAccount(null);
        setIsDeleteDialogOpen(false);
    };
    const handleDeleteAccount = async () => {
        if (!selectedAccount) return;
        try {
            const headers = await getAuthHeaders();
            await axios.post(`${apiUrl}/deleteAccount`, { docId: selectedAccount.id }, { headers });
            fetchAccounts();
            closeDeleteDialog();
        } catch (err) {
            console.error('Error deleting account:', err);
            alert(`Error deleting account: ${err.message}`);
        }
    };

    // -------------------- Toggle Active Flow --------------------
    const handleToggleActive = async (account) => {
        try {
            const headers = await getAuthHeaders();
            await axios.post(`${apiUrl}/editAccount`, { docId: account.id, active: !account.active }, { headers });
            fetchAccounts();
        } catch (err) {
            console.error('Error toggling active status:', err);
            alert(`Error toggling account: ${err.message}`);
        }
    };

    return (
        <MainCard
            title={
                <Grid container alignItems="center" justifyContent="space-between" spacing={2}>
                    <Grid item>
                        <Typography variant="h3">Accounts Manager</Typography>
                    </Grid>
                    <Grid item>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                            />
                            {user?.tables?.accounts?.includes('Create') && (
                                <Button variant="contained" startIcon={<IconBuildingSkyscraper />} onClick={openAddModal}>
                                    Add Account
                                </Button>
                            )}
                        </Box>
                    </Grid>
                </Grid>
            }
        >
            <Grid container spacing={2}>
                {filteredAccounts.map((acc) => {
                    // Outline color from acc.color or #666
                    const borderColor = acc.color || '#666';
                    // Build initials from name
                    const initials = (acc.name || '??')
                        .split(/\s+/)
                        .map((w) => w[0]?.toUpperCase() || '')
                        .join('');

                    return (
                        <Grid item xs={12} sm={6} md={4} lg={3} key={acc.id}>
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
                                    <Box
                                        sx={{
                                            width: 56,
                                            height: 56,
                                            fontSize: 20,
                                            fontWeight: 700,
                                            borderRadius: 1,
                                            backgroundColor: 'transparent',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: `2px solid ${borderColor}`,
                                            color: '#000'
                                        }}
                                    >
                                        {initials}
                                    </Box>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
                                        {acc.name || 'No Name'}
                                    </Typography>

                                    {/* Active/Disabled chip */}
                                    <Box>
                                        <Box
                                            sx={{
                                                display: 'inline-block',
                                                px: 1,
                                                py: 0.5,
                                                borderRadius: 1,
                                                fontSize: '0.75rem',
                                                fontWeight: 'bold',
                                                ...getStatusStyle(acc.active)
                                            }}
                                        >
                                            {acc.active ? 'Active' : 'Disabled'}
                                        </Box>
                                    </Box>
                                </CardContent>
                                <CardActions sx={{ justifyContent: 'center', p: 1 }}>
                                    {/* View Details => if user can Read */}
                                    {user?.tables?.accounts?.includes('Read') && (
                                        <Tooltip title="View Details">
                                            <IconButton onClick={() => navigate(`/account/${acc.id}`)}>
                                                <IconEye />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                    {/* Toggle Active => if user can Update */}
                                    {user?.tables?.accounts?.includes('Update') && (
                                        <Tooltip title={acc.active ? 'Suspend Account' : 'Activate Account'}>
                                            <IconButton onClick={() => handleToggleActive(acc)}>
                                                <IconPower />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                    {/* Delete => if user can Delete */}
                                    {user?.tables?.accounts?.includes('Delete') && (
                                        <Tooltip title="Delete Account">
                                            <IconButton onClick={() => openDeleteDialog(acc)}>
                                                {/* Removed color="error" so it's default gray */}
                                                <IconTrash />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                </CardActions>
                            </Card>
                        </Grid>
                    );
                })}
            </Grid>

            {/* Add Account Modal */}
            <Dialog open={isAddEditModalOpen} onClose={closeAddModal} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ pb: 1 }}>Add Account</DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Account Name
                    </Typography>
                    <TextField
                        fullWidth
                        placeholder="e.g. Acme Inc"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        sx={{ mb: 2 }}
                    />

                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Address
                    </Typography>
                    <TextField
                        fullWidth
                        placeholder="123 Main St"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        sx={{ mb: 2 }}
                    />

                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        City
                    </Typography>
                    <TextField
                        fullWidth
                        placeholder="New York"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        sx={{ mb: 2 }}
                    />

                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                State
                            </Typography>
                            <TextField
                                fullWidth
                                placeholder="NY"
                                value={formData.state}
                                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                            />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                ZIP
                            </Typography>
                            <TextField
                                fullWidth
                                placeholder="12345"
                                value={formData.zip}
                                onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                            />
                        </Box>
                    </Box>

                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Phone
                    </Typography>
                    <TextField
                        fullWidth
                        placeholder="(000) 000-0000"
                        value={formData.phone}
                        onChange={(e) => {
                            const { display } = formatPhoneInput(e.target.value);
                            setFormData({ ...formData, phone: display });
                        }}
                        sx={{ mb: 2 }}
                    />
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={closeAddModal} color="inherit">
                        Cancel
                    </Button>
                    <Button variant="contained" onClick={handleSaveAccount} disabled={!formData.name}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Account Dialog */}
            <Dialog open={isDeleteDialogOpen} onClose={closeDeleteDialog} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle>Delete Account</DialogTitle>
                <DialogContent sx={{ mt: 1 }}>
                    <Typography>
                        Are you sure you want to delete <strong>{selectedAccount?.name}</strong>?
                        <br />
                        This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={closeDeleteDialog} color="inherit">
                        Cancel
                    </Button>
                    {/* Removed color="error" => using default color for the delete button */}
                    <Button variant="contained" onClick={handleDeleteAccount}>
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </MainCard>
    );
};

export default AccountsManager;
