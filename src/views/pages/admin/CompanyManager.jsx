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
    CircularProgress,
    Snackbar,
    Alert,
    useTheme,
    useMediaQuery
} from '@mui/material';
import { IconSearch, IconBuildingSkyscraper, IconEdit, IconTrash } from '@tabler/icons-react';

import axios from 'axios';
import MainCard from 'ui-component/cards/MainCard';
import useAuth from 'hooks/useAuth';

/** Helper to get initials from a string (e.g., "Acme Corp" => "AC"). */
function getInitials(name = '') {
    return name
        .split(/\s+/)
        .map((w) => (w[0] || '').toUpperCase())
        .join('');
}

/** Format phone input as (###) ###-####. */
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

const apiUrl = import.meta.env.VITE_APP_API_URL;

const CompanyManager = () => {
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

    const { user } = useAuth();

    const getAuthHeaders = async () => {
        const firebaseUser = user?.firebaseUser;
        if (!firebaseUser) {
            console.warn('No firebaseUser found. Requests will fail with 401.');
            return {};
        }
        try {
            const idToken = await firebaseUser.getIdToken(/* forceRefresh */ true);
            return { Authorization: `Bearer ${idToken}` };
        } catch (error) {
            console.error('Error generating ID token:', error);
            throw new Error('Authentication failed. Please re-login.');
        }
    };

    // Local States
    const [companies, setCompanies] = useState([]);
    const [filteredCompanies, setFilteredCompanies] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState({
        open: false,
        message: '',
        severity: 'info'
    });

    // Add/Edit Modal
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        phone: '',
        license: '',
        web: ''
    });

    // Delete Modal
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // Fetch Companies on Mount
    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = async () => {
        setLoading(true);
        try {
            const headers = await getAuthHeaders();
            const resp = await axios.get(`${apiUrl}/getCompanies`, { headers });
            setCompanies(resp.data.data || []);
            setFilteredCompanies(resp.data.data || []);
        } catch (err) {
            console.error('Error fetching companies:', err);
            setNotification({
                open: true,
                message: 'Failed to fetch companies.',
                severity: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        const value = e.target.value.toLowerCase();
        setSearch(value);
        const newFiltered = companies.filter((co) => {
            return (
                co.name?.toLowerCase().includes(value) ||
                co.city?.toLowerCase().includes(value) ||
                co.license?.toLowerCase().includes(value) ||
                co.phone?.includes(value)
            );
        });
        setFilteredCompanies(newFiltered);
    };

    const openAddEditModal = (company = null) => {
        setSelectedCompany(company);
        if (company) {
            const phoneRaw = company.phone || '';
            const { display } = formatPhoneInput(phoneRaw);
            setFormData({
                name: company.name || '',
                address: company.address || '',
                city: company.city || '',
                state: company.state || '',
                zip: company.zip || '',
                phone: display,
                license: company.license || '',
                web: company.web || ''
            });
        } else {
            setFormData({
                name: '',
                address: '',
                city: '',
                state: '',
                zip: '',
                phone: '',
                license: '',
                web: ''
            });
        }
        setIsAddEditModalOpen(true);
    };

    const closeAddEditModal = () => {
        setIsAddEditModalOpen(false);
        setSelectedCompany(null);
    };

    const handleSaveCompany = async () => {
        setLoading(true);
        try {
            const payload = {
                name: formData.name.trim(),
                address: formData.address.trim(),
                city: formData.city.trim(),
                state: formData.state.trim(),
                zip: formData.zip.trim(),
                license: formData.license.trim(),
                web: formData.web.trim()
            };

            const digits = formData.phone.replace(/\D/g, '');
            payload.phone = digits.length === 10 ? '+1' + digits : digits;

            const headers = await getAuthHeaders();
            if (selectedCompany) {
                await axios.post(`${apiUrl}/editCompany`, { docId: selectedCompany.id, ...payload }, { headers });
            } else {
                await axios.post(`${apiUrl}/createCompany`, payload, { headers });
            }

            fetchCompanies();
            closeAddEditModal();
            setNotification({
                open: true,
                message: 'Company saved successfully!',
                severity: 'success'
            });
        } catch (err) {
            console.error('Error saving company:', err);
            setNotification({
                open: true,
                message: 'Failed to save company.',
                severity: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const openDeleteDialog = (company) => {
        setSelectedCompany(company);
        setIsDeleteDialogOpen(true);
    };

    const closeDeleteDialog = () => {
        setIsDeleteDialogOpen(false);
        setSelectedCompany(null);
    };

    const handleDeleteCompany = async () => {
        if (!selectedCompany) return;
        setLoading(true);
        try {
            const headers = await getAuthHeaders();
            await axios.post(`${apiUrl}/deleteCompany`, { docId: selectedCompany.id }, { headers });
            fetchCompanies();
            closeDeleteDialog();
            setNotification({
                open: true,
                message: 'Company deleted successfully!',
                severity: 'success'
            });
        } catch (err) {
            console.error('Error deleting company:', err);
            setNotification({
                open: true,
                message: 'Failed to delete company.',
                severity: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <MainCard
            title={
                <Grid container alignItems="center" justifyContent="space-between" spacing={2}>
                    <Grid item>
                        <Typography variant="h3">Company Manager</Typography>
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
                            <Button variant="contained" startIcon={<IconBuildingSkyscraper />} onClick={() => openAddEditModal()}>
                                Add Company
                            </Button>
                        </Box>
                    </Grid>
                </Grid>
            }
        >
            {loading ? (
                <Box sx={{ textAlign: 'center', mt: 3 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <Grid container spacing={2}>
                    {filteredCompanies.map((co) => {
                        const avatarColor = '#6a5acd';
                        const initials = getInitials(co.name || '');

                        return (
                            <Grid item xs={12} sm={6} md={4} lg={3} key={co.id}>
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
                                                fontSize: 20,
                                                fontWeight: 700
                                            }}
                                        >
                                            {initials}
                                        </Avatar>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
                                            {co.name || 'No Name'}
                                        </Typography>
                                    </CardContent>
                                    <CardActions sx={{ justifyContent: 'center', p: 1 }}>
                                        <Tooltip title="Edit Company">
                                            <IconButton onClick={() => openAddEditModal(co)}>
                                                <IconEdit />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete Company">
                                            <IconButton onClick={() => openDeleteDialog(co)}>
                                                <IconTrash />
                                            </IconButton>
                                        </Tooltip>
                                    </CardActions>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            )}

            {/* Notifications */}
            <Snackbar open={notification.open} autoHideDuration={6000} onClose={() => setNotification({ ...notification, open: false })}>
                <Alert onClose={() => setNotification({ ...notification, open: false })} severity={notification.severity}>
                    {notification.message}
                </Alert>
            </Snackbar>

            {/* Add/Edit Modal */}
            <Dialog open={isAddEditModalOpen} onClose={closeAddEditModal} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle>{selectedCompany ? 'Edit Company' : 'Add Company'}</DialogTitle>
                <DialogContent>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Company Name
                    </Typography>
                    <TextField
                        fullWidth
                        placeholder="e.g. Acme Corp"
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

                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        License #
                    </Typography>
                    <TextField
                        fullWidth
                        placeholder="DCA12345"
                        value={formData.license}
                        onChange={(e) => setFormData({ ...formData, license: e.target.value })}
                        sx={{ mb: 2 }}
                    />

                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Website
                    </Typography>
                    <TextField
                        fullWidth
                        placeholder="www.example.com"
                        value={formData.web}
                        onChange={(e) => setFormData({ ...formData, web: e.target.value })}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeAddEditModal}>Cancel</Button>
                    <Button onClick={handleSaveCompany} disabled={!formData.name}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog open={isDeleteDialogOpen} onClose={closeDeleteDialog} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle>Delete Company</DialogTitle>
                <DialogContent>
                    Are you sure you want to delete <strong>{selectedCompany?.name}</strong>?
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDeleteDialog}>Cancel</Button>
                    <Button onClick={handleDeleteCompany} variant="contained" color="error">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </MainCard>
    );
};

export default CompanyManager;
