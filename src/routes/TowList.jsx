import React, { useEffect, useState, useMemo } from 'react';
import { Grid, TextField, Button, Card, CardContent, IconButton, Typography } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';

import MainCard from 'ui-component/cards/MainCard';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';

import { db } from 'firebase.js'; // adapt to your Firebase config import
import useAuth from 'hooks/useAuth'; // if you need auth-based checks

/**
 * Step 1: The All Tows Page
 *
 * - Displays a table of docs from the `tows` collection.
 * - Basic search by receiptNumber (example).
 * - "Add New" button => navigate("/tow-jobs/new")
 * - On row edit => navigate("/tow-jobs/<docId>")
 */

const TowList = () => {
    const navigate = useNavigate();
    const { user } = useAuth(); // in case you do role-based checks

    const [searchTerm, setSearchTerm] = useState('');
    const [tows, setTows] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch tows on mount or when search changes
    useEffect(() => {
        const fetchTows = async () => {
            setLoading(true);

            try {
                // Basic example: if searching by receiptNumber
                // If you want advanced queries or composite indexes, adjust accordingly
                let q_ = collection(db, 'tows');
                // example usage: if searchTerm => we can do a where, but only if you have an index or direct equality
                // For a partial search, you might fetch all & filter client-side or implement a more advanced approach.

                // Minimal approach: fetch all tows, filter in client side (if small data set).
                const snap = await getDocs(q_);
                let arr = snap.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data()
                }));

                if (searchTerm) {
                    const termLower = searchTerm.toLowerCase();
                    arr = arr.filter((tow) =>
                        String(tow.receiptNumber || '')
                            .toLowerCase()
                            .includes(termLower)
                    );
                }

                setTows(arr);
            } catch (err) {
                console.error('Error fetching tows:', err);
            }
            setLoading(false);
        };

        fetchTows();
    }, [searchTerm]);

    // DataGrid columns
    const columns = useMemo(() => {
        return [
            {
                field: 'receiptNumber',
                headerName: 'Receipt #',
                flex: 1,
                renderCell: (params) => (
                    <Typography variant="body2" color="primary">
                        {params.value || '—'}
                    </Typography>
                )
            },
            {
                field: 'dateTime',
                headerName: 'Date/Time',
                flex: 1,
                valueGetter: (params) => {
                    // if you stored as a Firestore timestamp, convert to a readable string
                    const val = params.row.dateTime;
                    if (!val) return '';
                    if (val.toDate) {
                        // Firestore Timestamp
                        return val.toDate().toLocaleString();
                    }
                    // if stored as ISO string
                    return new Date(val).toLocaleString();
                }
            },
            {
                field: 'jobType',
                headerName: 'Job Type',
                flex: 1,
                // if you store jobType as a string or docRef, adapt as needed
                valueGetter: (params) => {
                    // if it's a string like "local_tow"
                    return params.row.jobType || '';
                }
            },
            {
                field: 'reason',
                headerName: 'Reason',
                flex: 1,
                valueGetter: (params) => {
                    return params.row.reason || '';
                }
            },
            {
                field: 'operatorUser',
                headerName: 'Operator',
                flex: 1,
                valueGetter: (params) => {
                    // if operatorUser is a name or docRef, adapt accordingly
                    return params.row.operatorUserName || ''; // or row.operatorName if you store it
                }
            },
            {
                field: 'status',
                headerName: 'Status',
                flex: 1,
                valueGetter: (params) => {
                    // if you store a simple status field or deduce from timeline
                    return params.row.currentStatus || 'Requested';
                }
            },
            {
                field: 'action',
                headerName: 'Action',
                sortable: false,
                filterable: false,
                width: 80,
                renderCell: (params) => {
                    return (
                        <IconButton color="primary" onClick={() => navigate(`/tow-jobs/${params.row.id}`)}>
                            <EditIcon />
                        </IconButton>
                    );
                }
            }
        ];
    }, [navigate]);

    // "Add New" button
    const handleAddNew = () => {
        navigate('/tow-jobs/new');
    };

    return (
        <MainCard title="All Tow Jobs">
            <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'center' }}>
                    <TextField
                        label="Search by Receipt #"
                        variant="outlined"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                            endAdornment: <SearchIcon sx={{ cursor: 'pointer' }} />
                        }}
                        fullWidth
                    />
                </Grid>

                <Grid item xs={12} md={6} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddNew}>
                        Add New Tow
                    </Button>
                </Grid>
            </Grid>

            <div style={{ height: 500, width: '100%' }}>
                <DataGrid rows={tows} columns={columns} pageSize={10} loading={loading} disableSelectionOnClick />
            </div>
        </MainCard>
    );
};

export default TowList;
