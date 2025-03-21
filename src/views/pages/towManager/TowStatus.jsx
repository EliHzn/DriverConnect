import React, { useState } from 'react';
import { Grid, Typography, TextField, Button, List, ListItem, ListItemText } from '@mui/material';

/**
 * This tab:
 *  - shows a timeline of status changes
 *  - user can add new status with a note
 */

const TowStatus = () => {
    const [statusList, setStatusList] = useState([
        { status: 'Requested', note: 'Tow job created', timestamp: new Date().toLocaleString() }
    ]);
    const [newStatus, setNewStatus] = useState('');
    const [newNote, setNewNote] = useState('');

    const handleAddStatus = () => {
        if (!newStatus) return;
        const st = {
            status: newStatus,
            note: newNote,
            timestamp: new Date().toLocaleString()
        };
        setStatusList((prev) => [...prev, st]);
        setNewStatus('');
        setNewNote('');
    };

    return (
        <Grid container spacing={2}>
            <Grid item xs={12}>
                <List>
                    {statusList.map((st, idx) => (
                        <ListItem key={idx}>
                            <ListItemText primary={`${st.status} - ${st.timestamp}`} secondary={st.note} />
                        </ListItem>
                    ))}
                </List>
            </Grid>

            <Grid item xs={12} sm={4}>
                <TextField label="New Status" value={newStatus} onChange={(e) => setNewStatus(e.target.value)} fullWidth />
            </Grid>
            <Grid item xs={12} sm={6}>
                <TextField label="Note" value={newNote} onChange={(e) => setNewNote(e.target.value)} fullWidth />
            </Grid>
            <Grid item xs={12} sm={2} sx={{ display: 'flex', alignItems: 'center' }}>
                <Button variant="contained" onClick={handleAddStatus}>
                    Add
                </Button>
            </Grid>
            <Grid item xs={12}>
                <Typography variant="body2" color="textSecondary">
                    (In a real app, you’d store these statuses in Firestore’s doc or subcollection.)
                </Typography>
            </Grid>
        </Grid>
    );
};

export default TowStatus;
