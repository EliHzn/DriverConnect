// C:\Users\eliha\firebase\webapp\src\utils\route-guard\RoleGuard.jsx
import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { CircularProgress } from '@mui/material';

import useAuth from 'hooks/useAuth';

/**
 * RoleGuard checks if the user has permission to view a given page.
 * If loading => spinner/placeholder.
 * Once loaded, if user.pages doesn't include the page => go to /unauthorized.
 */
const RoleGuard = ({ pageName, children }) => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        // Once finished loading, check if user.pages is set
        if (!loading && user?.pages) {
            // If the user does not have this page in their pages array => unauthorized
            if (!user.pages.includes(pageName)) {
                navigate('/unauthorized', { replace: true });
            }
        }
    }, [loading, user, pageName, navigate]);

    // Show spinner/placeholder while loading or if user.pages is undefined
    if (loading || !user?.pages) {
        return (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                <CircularProgress />
                <p>Loading user permissions...</p>
            </div>
        );
    }

    // If we’re done loading and the user has the page => render children
    return children;
};

RoleGuard.propTypes = {
    pageName: PropTypes.string.isRequired,
    children: PropTypes.node
};

export default RoleGuard;
