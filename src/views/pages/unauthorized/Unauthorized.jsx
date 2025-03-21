import React from 'react';
import { Link } from 'react-router-dom';
// material-ui
import { Button, Typography } from '@mui/material';
// project imports
import MainCard from 'ui-component/cards/MainCard';

const Unauthorized = () => {
    return (
        <MainCard title="Insufficient Privileges">
            <Typography variant="body2" paragraph>
                You don’t have permission to access this page. If you believe this is an error, please contact your administrator.
            </Typography>
            <Button variant="contained" component={Link} to="/dashboard">
                Return to Dashboard
            </Button>
        </MainCard>
    );
};

export default Unauthorized;
