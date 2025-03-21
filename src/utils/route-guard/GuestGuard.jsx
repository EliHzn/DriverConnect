// C:\Users\eliha\firebase\webapp\src\utils\route-guard\GuestGuard.jsx
import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';

// project imports
import useAuth from 'hooks/useAuth'; // <-- default import, no curly braces
import { DASHBOARD_PATH } from 'config';

// ==============================|| GUEST GUARD ||============================== //
/**
 * Guest guard for routes that require no authentication.
 * - If we are still loading auth state, show nothing (or a spinner).
 * - If the user is already logged in, redirect to the dashboard.
 * - Otherwise, render the children.
 */
const GuestGuard = ({ children }) => {
    const { isLoggedIn, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && isLoggedIn) {
            navigate(DASHBOARD_PATH, { replace: true });
        }
    }, [loading, isLoggedIn, navigate]);

    if (loading) {
        // Optionally show a loading indicator
        return null;
    }

    return children;
};

GuestGuard.propTypes = {
    children: PropTypes.node
};

export default GuestGuard;
