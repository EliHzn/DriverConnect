import React, { useState } from 'react';
import { Grid, TextField, Typography, Button } from '@mui/material';

/**
 *  This tab covers:
 *   - Customer name/address/phone/license
 *   - Possibly required doc uploads (driver license, registration, insurance)
 *   - We'll store only references, so user picks files => you upload to Storage => store URLs
 */

const TowCustomerInfo = () => {
    const [custName, setCustName] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [zip, setZip] = useState('');
    const [phone, setPhone] = useState('');
    const [licenseNumber, setLicenseNumber] = useState('');

    // For uploads
    const handleFileUpload = (e, docType) => {
        const file = e.target.files[0];
        if (!file) return;
        // TODO: Upload to Firebase Storage, then store the URL in your doc
        alert(`Uploading ${file.name} as ${docType}`);
    };

    return (
        <Grid container spacing={2}>
            {/* Customer Basic Info */}
            <Grid item xs={12} sm={6}>
                <TextField label="Customer Name" value={custName} onChange={(e) => setCustName(e.target.value)} fullWidth />
            </Grid>
            <Grid item xs={12} sm={6}>
                <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
            </Grid>
            <Grid item xs={12}>
                <TextField label="Address" value={address} onChange={(e) => setAddress(e.target.value)} fullWidth />
            </Grid>
            <Grid item xs={6} sm={3}>
                <TextField label="City" value={city} onChange={(e) => setCity(e.target.value)} fullWidth />
            </Grid>
            <Grid item xs={6} sm={3}>
                <TextField label="State" value={state} onChange={(e) => setState(e.target.value)} fullWidth />
            </Grid>
            <Grid item xs={6} sm={3}>
                <TextField label="ZIP" value={zip} onChange={(e) => setZip(e.target.value)} fullWidth />
            </Grid>
            <Grid item xs={6} sm={3}>
                <TextField label="License Number" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} fullWidth />
            </Grid>

            {/* Upload placeholders */}
            <Grid item xs={12}>
                <Typography variant="h6">Uploads</Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
                <Button variant="outlined" component="label">
                    Upload Driver License
                    <input hidden accept="image/*" multiple type="file" onChange={(e) => handleFileUpload(e, 'driverLicense')} />
                </Button>
            </Grid>
            <Grid item xs={12} sm={4}>
                <Button variant="outlined" component="label">
                    Upload Registration
                    <input hidden accept="image/*" multiple type="file" onChange={(e) => handleFileUpload(e, 'registration')} />
                </Button>
            </Grid>
            <Grid item xs={12} sm={4}>
                <Button variant="outlined" component="label">
                    Upload Insurance
                    <input hidden accept="image/*" multiple type="file" onChange={(e) => handleFileUpload(e, 'insurance')} />
                </Button>
            </Grid>
        </Grid>
    );
};

export default TowCustomerInfo;
