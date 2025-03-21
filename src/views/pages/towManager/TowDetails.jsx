import React, { useEffect, useState } from 'react';
import { Grid, TextField, MenuItem } from '@mui/material';
import { db } from 'firebase.js';
import { collection, getDocs } from 'firebase/firestore';

const TowDetails = ({ data, onChange, disabled }) => {
    const [jobCategories, setJobCategories] = useState([]);
    const [towReasons, setTowReasons] = useState([]);

    useEffect(() => {
        const fetchLookups = async () => {
            const catSnap = await getDocs(collection(db, 'jobCategories'));
            const catArr = catSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setJobCategories(catArr);

            const reasonSnap = await getDocs(collection(db, 'towReasons'));
            const reasonArr = reasonSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setTowReasons(reasonArr);
        };
        fetchLookups();
    }, []);

    // Handler for local changes => calls parent's onChange
    const handleFieldChange = (field, val) => {
        onChange({
            [field]: val
        });
    };

    return (
        <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
                <TextField
                    label="Receipt Number"
                    value={data.receiptNumber || ''}
                    onChange={(e) => handleFieldChange('receiptNumber', e.target.value)}
                    fullWidth
                    disabled={disabled}
                />
            </Grid>
            <Grid item xs={12} sm={6}>
                <TextField
                    label="Date/Time"
                    type="datetime-local"
                    value={data.dateTime || ''}
                    onChange={(e) => handleFieldChange('dateTime', e.target.value)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    disabled={disabled}
                />
            </Grid>

            <Grid item xs={12} sm={6}>
                <TextField
                    select
                    label="Job Type"
                    value={data.jobType || ''}
                    onChange={(e) => handleFieldChange('jobType', e.target.value)}
                    fullWidth
                    disabled={disabled}
                >
                    <MenuItem value="">
                        <em>None</em>
                    </MenuItem>
                    {jobCategories.map((cat) => (
                        <MenuItem key={cat.id} value={cat.id}>
                            {cat.name}
                        </MenuItem>
                    ))}
                </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
                <TextField
                    select
                    label="Reason"
                    value={data.reason || ''}
                    onChange={(e) => handleFieldChange('reason', e.target.value)}
                    fullWidth
                    disabled={disabled}
                >
                    <MenuItem value="">
                        <em>None</em>
                    </MenuItem>
                    {towReasons.map((r) => (
                        <MenuItem key={r.id} value={r.id}>
                            {r.name}
                        </MenuItem>
                    ))}
                </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
                <TextField
                    label="Operator Name"
                    value={data.operatorUserName || ''}
                    onChange={(e) => handleFieldChange('operatorUserName', e.target.value)}
                    fullWidth
                    disabled={disabled}
                />
            </Grid>

            <Grid item xs={12} sm={6}>
                <TextField
                    label="Status"
                    value={data.currentStatus || ''}
                    onChange={(e) => handleFieldChange('currentStatus', e.target.value)}
                    fullWidth
                    disabled={disabled}
                />
            </Grid>
        </Grid>
    );
};

export default TowDetails;
