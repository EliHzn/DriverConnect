// C:\Users\eliha\firebase\webapp\src\views\pages\operations\AccountDetails.jsx

import React, { useEffect, useState } from 'react';
import {
    Box,
    Grid,
    Typography,
    TextField,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Paper,
    CircularProgress,
    Card,
    CardContent,
    CardActions,
    Chip,
    Checkbox,
    FormControlLabel,
    useTheme,
    useMediaQuery,
    Snackbar,
    Alert
} from '@mui/material';
import { IconEdit, IconTrash, IconPlus, IconPower } from '@tabler/icons-react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

import MainCard from 'ui-component/cards/MainCard';
import useAuth from 'hooks/useAuth';

/**
 * Nicely format phone numbers while typing, ignoring an initial '1'.
 * If digits > 10, slice.
 */
function formatPhoneInput(value) {
    let digits = value.replace(/\D/g, '');
    if (digits.startsWith('1') && digits.length === 11) {
        digits = digits.slice(1);
    }
    if (digits.length > 10) digits = digits.slice(0, 10);

    let display = '';
    if (digits.length >= 1) display = '(' + digits.slice(0, 3);
    if (digits.length >= 4) display = '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6);
    if (digits.length >= 7) display += '-' + digits.slice(6);
    return display;
}

/**
 * Convert a raw phone input (which may have a leading +1 or digits)
 * to exactly +1XXXXXXXXXX stored in Firestore, ignoring an initial 1.
 */
function toFirestorePhone(value) {
    let digits = value.replace(/\D/g, '');
    // If starts with 1 and length=11, remove leading '1'
    if (digits.startsWith('1') && digits.length === 11) {
        digits = digits.slice(1);
    }
    if (digits.length > 10) digits = digits.slice(0, 10);
    return digits.length === 10 ? '+1' + digits : digits;
}

/**
 * Capitalize the first letter of each word.
 */
function capitalizeWords(str) {
    return str
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Chip style for "Active" vs "Disabled."
 */
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

/**
 * A small square avatar with an outline color + two-letter initials.
 */
function AccountSquareAvatar({ color, name }) {
    const borderColor = color || '#666';
    const words = name ? name.split(/\s+/) : ['??'];
    const initials = words.map((w) => (w[0] || '').toUpperCase()).join('');

    return (
        <Box
            sx={{
                width: 48,
                height: 48,
                fontSize: 16,
                fontWeight: 700,
                borderRadius: 1,
                backgroundColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `2px solid ${borderColor}`,
                color: '#000',
                mr: 1
            }}
        >
            {initials}
        </Box>
    );
}

const apiUrl = import.meta.env.VITE_APP_API_URL;

const AccountDetails = () => {
    const theme = useTheme();
    const isMdDown = useMediaQuery(theme.breakpoints.down('md'));
    const { docId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [accountData, setAccountData] = useState(null);
    const [isEditingAccount, setIsEditingAccount] = useState(false);

    // Top-level fields for the edit form
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        phone: '',
        active: false,
        color: ''
    });

    // Contacts
    const [contacts, setContacts] = useState([]);
    const [isContactsChanged, setIsContactsChanged] = useState(false);

    // For adding/editing a contact
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [contactIndex, setContactIndex] = useState(-1);
    const [contactForm, setContactForm] = useState({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        title: '',
        primary: false
    });

    // For deleting the entire account
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // Snackbar
    const [snackOpen, setSnackOpen] = useState(false);
    const [snackMessage, setSnackMessage] = useState('');
    const [snackSeverity, setSnackSeverity] = useState('success');

    const canUpdate = user?.tables?.accounts?.includes('Update');
    const canDelete = user?.tables?.accounts?.includes('Delete');

    // Build auth headers
    const getAuthHeaders = async () => {
        const firebaseUser = user?.firebaseUser;
        if (!firebaseUser) return {};
        const idToken = await firebaseUser.getIdToken(true);
        return { Authorization: `Bearer ${idToken}` };
    };

    const showSnackbar = (message, severity = 'success') => {
        setSnackMessage(message);
        setSnackSeverity(severity);
        setSnackOpen(true);
    };
    const closeSnackbar = () => {
        setSnackOpen(false);
    };

    // Fetch the account doc by docId
    const fetchAccount = async () => {
        try {
            setLoading(true);
            const headers = await getAuthHeaders();
            const resp = await axios.get(`${apiUrl}/getAccounts`, { headers });
            const all = resp.data.data || [];
            const found = all.find((acc) => acc.id === docId);
            if (!found) {
                showSnackbar('Account not found!', 'error');
                navigate('/accounts-manager', { replace: true });
                return;
            }
            setAccountData(found);

            // Populate form data
            setFormData({
                name: capitalizeWords(found.name || ''),
                address: capitalizeWords(found.address || ''),
                city: capitalizeWords(found.city || ''),
                state: capitalizeWords(found.state || ''),
                zip: found.zip || '',
                phone: formatPhoneInput(found.phone || ''),
                active: !!found.active,
                color: found.color || ''
            });

            // If 'contacts' is an array
            setContacts(Array.isArray(found.contacts) ? found.contacts : []);
        } catch (err) {
            console.error('Error fetching account:', err);
            showSnackbar(`Error fetching account: ${err.message}`, 'error');
            navigate('/accounts-manager', { replace: true });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAccount();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [docId]);

    // Toggle active
    const handleToggleActive = async () => {
        if (!accountData) return;
        try {
            const headers = await getAuthHeaders();
            const newActive = !accountData.active;
            await axios.post(`${apiUrl}/editAccount`, { docId, active: newActive }, { headers });
            setAccountData((prev) => (prev ? { ...prev, active: newActive } : prev));
            showSnackbar(`Account is now ${newActive ? 'Active' : 'Disabled'}`);
        } catch (err) {
            console.error('Error toggling active:', err);
            showSnackbar(`Error toggling account: ${err.message}`, 'error');
        }
    };

    // Edit account
    const handleEditAccount = () => {
        setIsEditingAccount(true);
    };

    // Cancel edit
    const handleCancelEdit = () => {
        if (!accountData) return;
        // revert
        setFormData({
            name: capitalizeWords(accountData.name || ''),
            address: capitalizeWords(accountData.address || ''),
            city: capitalizeWords(accountData.city || ''),
            state: capitalizeWords(accountData.state || ''),
            zip: accountData.zip || '',
            phone: formatPhoneInput(accountData.phone || ''),
            active: !!accountData.active,
            color: accountData.color || ''
        });
        setIsEditingAccount(false);
    };

    // Save account
    const handleSaveAccount = async () => {
        try {
            const headers = await getAuthHeaders();
            const firestorePhone = toFirestorePhone(formData.phone);

            const payload = {
                docId,
                name: capitalizeWords(formData.name.trim()),
                address: capitalizeWords(formData.address.trim()),
                city: capitalizeWords(formData.city.trim()),
                state: capitalizeWords(formData.state.trim()),
                zip: formData.zip.trim(),
                phone: firestorePhone,
                active: formData.active,
                color: formData.color,
                contacts
            };
            await axios.post(`${apiUrl}/editAccount`, payload, { headers });
            setAccountData((prev) => (prev ? { ...prev, ...payload } : prev));
            setIsEditingAccount(false);
            showSnackbar('Account updated successfully!');
        } catch (err) {
            console.error('Error saving account:', err);
            showSnackbar(`Error saving account: ${err.message}`, 'error');
        }
    };

    // ---------- Contacts CRUD ----------
    const handleAddContact = () => {
        setContactIndex(-1);
        setContactForm({
            firstName: '',
            lastName: '',
            phone: '',
            email: '',
            title: '',
            primary: false
        });
        setIsContactModalOpen(true);
    };

    const handleEditContact = (idx) => {
        setContactIndex(idx);
        const c = contacts[idx];
        setContactForm({
            firstName: capitalizeWords(c.firstName || ''),
            lastName: capitalizeWords(c.lastName || ''),
            phone: formatPhoneInput(c.phone || ''),
            email: capitalizeWords(c.email || ''),
            title: capitalizeWords(c.title || ''),
            primary: !!c.primary
        });
        setIsContactModalOpen(true);
    };

    const handleSaveContact = () => {
        const updated = [...contacts];
        const firestorePhone = toFirestorePhone(contactForm.phone);

        const newObj = {
            firstName: capitalizeWords(contactForm.firstName.trim()),
            lastName: capitalizeWords(contactForm.lastName.trim()),
            phone: firestorePhone,
            email: capitalizeWords(contactForm.email.trim()),
            title: capitalizeWords(contactForm.title.trim()),
            primary: contactForm.primary
        };

        if (contactIndex >= 0) {
            updated[contactIndex] = newObj;
        } else {
            updated.push(newObj);
        }
        setContacts(updated);
        setIsContactsChanged(true);
        setIsContactModalOpen(false);
    };

    const handleDeleteContact = (idx) => {
        const updated = [...contacts];
        updated.splice(idx, 1);
        setContacts(updated);
        setIsContactsChanged(true);
    };

    const handleSaveAllContactsToServer = async () => {
        try {
            const headers = await getAuthHeaders();
            await axios.post(
                `${apiUrl}/editAccount`,
                {
                    docId,
                    contacts
                },
                { headers }
            );
            setIsContactsChanged(false);
            showSnackbar('Contacts updated successfully!');
        } catch (err) {
            console.error('Error saving contacts:', err);
            showSnackbar(`Error saving contacts: ${err.message}`, 'error');
        }
    };

    // Delete entire account
    const handleDeleteAccount = async () => {
        try {
            const headers = await getAuthHeaders();
            await axios.post(`${apiUrl}/deleteAccount`, { docId }, { headers });
            showSnackbar('Account deleted successfully!');
            navigate('/accounts-manager');
        } catch (err) {
            console.error('Error deleting account:', err);
            showSnackbar(`Error deleting account: ${err.message}`, 'error');
        }
    };

    if (loading) {
        return (
            <MainCard>
                <Box sx={{ textAlign: 'center', mt: 4 }}>
                    <CircularProgress />
                </Box>
            </MainCard>
        );
    }

    if (!accountData) {
        return (
            <MainCard>
                <Typography variant="h5" color="error">
                    Account not found.
                </Typography>
                <Button onClick={() => navigate('/accounts-manager')} sx={{ mt: 2 }}>
                    Back to Accounts Manager
                </Button>
            </MainCard>
        );
    }

    return (
        <MainCard>
            {/* Snackbar */}
            <Snackbar
                open={snackOpen}
                autoHideDuration={3000}
                onClose={closeSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={closeSnackbar} severity={snackSeverity} variant="filled">
                    {snackMessage}
                </Alert>
            </Snackbar>

            {/* Header row: square avatar + name + active chip + toggle icon */}
            <Box
                sx={{
                    mb: 2,
                    display: 'flex',
                    flexDirection: isMdDown ? 'column' : 'row',
                    alignItems: isMdDown ? 'flex-start' : 'center',
                    gap: 2
                }}
            >
                <AccountSquareAvatar color={accountData.color} name={accountData.name} />
                <Box sx={{ flex: 1 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {capitalizeWords(accountData.name || '')}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                        <Box
                            sx={{
                                display: 'inline-block',
                                px: 1,
                                py: 0.5,
                                borderRadius: 1,
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                ...getStatusStyle(accountData.active)
                            }}
                        >
                            {accountData.active ? 'Active' : 'Disabled'}
                        </Box>
                        {canUpdate && (
                            <IconButton onClick={handleToggleActive} sx={{ ml: 1, color: 'inherit' }}>
                                <IconPower />
                            </IconButton>
                        )}
                    </Box>
                </Box>
            </Box>

            {/* Account Info Card */}
            <Card sx={{ mb: 3, borderRadius: 2 }}>
                <CardContent>
                    {isEditingAccount ? (
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Account Name"
                                    value={formData.name}
                                    onChange={(e) => {
                                        const val = capitalizeWords(e.target.value);
                                        setFormData({ ...formData, name: val });
                                    }}
                                    fullWidth
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Phone"
                                    value={formData.phone}
                                    onChange={(e) => {
                                        let rawDigits = e.target.value.replace(/\D/g, '').slice(0, 10);
                                        const display = formatPhoneInput(rawDigits);
                                        setFormData({ ...formData, phone: display });
                                    }}
                                    fullWidth
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    label="Address"
                                    value={formData.address}
                                    onChange={(e) => {
                                        const val = capitalizeWords(e.target.value);
                                        setFormData({ ...formData, address: val });
                                    }}
                                    fullWidth
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <TextField
                                    label="City"
                                    value={formData.city}
                                    onChange={(e) => {
                                        const val = capitalizeWords(e.target.value);
                                        setFormData({ ...formData, city: val });
                                    }}
                                    fullWidth
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <TextField
                                    label="State"
                                    value={formData.state}
                                    onChange={(e) => {
                                        const val = capitalizeWords(e.target.value);
                                        setFormData({ ...formData, state: val });
                                    }}
                                    fullWidth
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <TextField
                                    label="ZIP"
                                    value={formData.zip}
                                    onChange={(e) => {
                                        setFormData({ ...formData, zip: e.target.value });
                                    }}
                                    fullWidth
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <FormControlLabel
                                    label="Is Active?"
                                    control={
                                        <Checkbox
                                            checked={formData.active}
                                            onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                                            color="primary"
                                        />
                                    }
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    type="color"
                                    label="Color"
                                    value={formData.color}
                                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                    fullWidth
                                    sx={{ height: 56 }}
                                />
                            </Grid>
                            <Grid item xs={12} sx={{ display: 'flex', gap: 2, mt: 2 }}>
                                <Button variant="outlined" onClick={handleCancelEdit}>
                                    Cancel
                                </Button>
                                <Button variant="contained" onClick={handleSaveAccount}>
                                    Save
                                </Button>
                            </Grid>
                        </Grid>
                    ) : (
                        <>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {capitalizeWords(accountData.address || '')}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                                {capitalizeWords(accountData.city || '')}, {capitalizeWords(accountData.state || '')} {accountData.zip}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {formatPhoneInput((accountData.phone || '').replace(/\D/g, ''))}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, gap: 1 }}>
                                {canUpdate && (
                                    <IconButton onClick={() => setIsEditingAccount(true)} sx={{ color: 'inherit' }}>
                                        <IconEdit />
                                    </IconButton>
                                )}
                                {canDelete && (
                                    <IconButton onClick={() => setIsDeleteDialogOpen(true)} sx={{ color: 'inherit' }}>
                                        <IconTrash />
                                    </IconButton>
                                )}
                            </Box>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Contacts Section */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    Contacts
                </Typography>
                {canUpdate && (
                    <Button startIcon={<IconPlus />} onClick={handleAddContact} variant="contained">
                        Add Contact
                    </Button>
                )}
            </Box>

            <Grid container spacing={2}>
                {contacts.length === 0 ? (
                    <Grid item xs={12}>
                        <Paper sx={{ p: 2, textAlign: 'center' }}>No contacts found.</Paper>
                    </Grid>
                ) : (
                    contacts.map((c, idx) => {
                        const fullName = capitalizeWords(((c.firstName || '') + ' ' + (c.lastName || '')).trim());
                        const phoneDisplay = formatPhoneInput(c.phone || '');
                        const emailDisplay = capitalizeWords(c.email || '');
                        const titleDisplay = capitalizeWords(c.title || '');

                        return (
                            <Grid item xs={12} sm={6} md={4} lg={3} key={idx}>
                                <Card
                                    sx={{
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                                        '&:hover': {
                                            boxShadow: theme.shadows[4],
                                            transform: 'translateY(-2px)'
                                        },
                                        display: 'flex',
                                        flexDirection: 'column',
                                        height: '100%'
                                    }}
                                >
                                    <CardContent
                                        sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: 0.5,
                                            p: 2
                                        }}
                                    >
                                        <Typography variant="subtitle1" sx={{ fontWeight: 700, textAlign: 'center' }}>
                                            {fullName || 'No Name'}
                                        </Typography>
                                        {phoneDisplay && (
                                            <Typography variant="body2" sx={{ textAlign: 'center' }}>
                                                {phoneDisplay}
                                            </Typography>
                                        )}
                                        {emailDisplay && (
                                            <Typography variant="body2" sx={{ textAlign: 'center' }}>
                                                {emailDisplay}
                                            </Typography>
                                        )}
                                        {titleDisplay && (
                                            <Typography variant="body2" sx={{ textAlign: 'center' }}>
                                                {titleDisplay}
                                            </Typography>
                                        )}
                                        {c.primary && <Chip label="Primary" color="success" size="small" sx={{ mt: 0.5 }} />}
                                    </CardContent>
                                    {canUpdate && (
                                        <CardActions sx={{ justifyContent: 'center', p: 1 }}>
                                            <IconButton onClick={() => handleEditContact(idx)} sx={{ color: 'inherit' }}>
                                                <IconEdit />
                                            </IconButton>
                                            <IconButton onClick={() => handleDeleteContact(idx)} sx={{ color: 'inherit' }}>
                                                <IconTrash />
                                            </IconButton>
                                        </CardActions>
                                    )}
                                </Card>
                            </Grid>
                        );
                    })
                )}
            </Grid>

            {canUpdate && isContactsChanged && contacts.length > 0 && (
                <Box sx={{ textAlign: 'right', mt: 2 }}>
                    <Button variant="contained" onClick={handleSaveAllContactsToServer}>
                        Save All Contacts
                    </Button>
                </Box>
            )}

            {/* Add/Edit Contact Modal */}
            <Dialog open={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{contactIndex >= 0 ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
                <DialogContent>
                    <Box sx={{ mb: 2 }}>
                        <TextField
                            label="First Name"
                            fullWidth
                            value={contactForm.firstName}
                            onChange={(e) => {
                                const val = capitalizeWords(e.target.value);
                                setContactForm({ ...contactForm, firstName: val });
                            }}
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            label="Last Name"
                            fullWidth
                            value={contactForm.lastName}
                            onChange={(e) => {
                                const val = capitalizeWords(e.target.value);
                                setContactForm({ ...contactForm, lastName: val });
                            }}
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            label="Phone"
                            fullWidth
                            value={contactForm.phone}
                            onChange={(e) => {
                                let rawDigits = e.target.value.replace(/\D/g, '').slice(0, 10);
                                const display = formatPhoneInput(rawDigits);
                                setContactForm({ ...contactForm, phone: display });
                            }}
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            label="Email"
                            fullWidth
                            value={contactForm.email}
                            onChange={(e) => {
                                const val = capitalizeWords(e.target.value);
                                setContactForm({ ...contactForm, email: val });
                            }}
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            label="Title"
                            fullWidth
                            value={contactForm.title}
                            onChange={(e) => {
                                const val = capitalizeWords(e.target.value);
                                setContactForm({ ...contactForm, title: val });
                            }}
                            sx={{ mb: 2 }}
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={contactForm.primary}
                                    onChange={(e) => setContactForm({ ...contactForm, primary: e.target.checked })}
                                    color="primary"
                                />
                            }
                            label="Primary Contact?"
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsContactModalOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSaveContact}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Account Dialog */}
            <Dialog open={isDeleteDialogOpen} onClose={() => setIsDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Delete Account</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete <strong>{accountData?.name}</strong>?
                        <br />
                        This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                    {/* Removed color="error" => defaults to gray */}
                    <Button variant="contained" onClick={handleDeleteAccount}>
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </MainCard>
    );
};

export default AccountDetails;
