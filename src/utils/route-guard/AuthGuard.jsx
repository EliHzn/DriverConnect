import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import useAuth from 'hooks/useAuth';

const AuthGuard = ({ children }) => {
    const { isLoggedIn, loading } = useAuth();
    const navigate = useNavigate();

    // 1) If we’re still loading the Firebase auth state, show a spinner
    if (loading) {
        return (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                <CircularProgress />
                <p>Verifying authentication...</p>
            </div>
        );
    }

    // 2) Once loading is done, if we’re NOT logged in => do the navigation in a useEffect
    useEffect(() => {
        if (!loading && !isLoggedIn) {
            navigate('/login', { replace: true });
        }
    }, [loading, isLoggedIn, navigate]);

    // 3) If we *are* logged in => render children
    if (!isLoggedIn) {
        // We can return null while the useEffect triggers the redirect
        return null;
    }

    return children;
};

AuthGuard.propTypes = {
    children: PropTypes.node
};

export default AuthGuard;
