// C:\Users\eliha\firebase\webapp\src\contexts\FirebaseContext.jsx

import PropTypes from 'prop-types';
import React, { createContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

// Create the context
const FirebaseContext = createContext(null);

export const FirebaseProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        // Listen for auth state changes
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                // Not logged in
                setUser(null);
                setIsInitialized(true);
                return;
            }

            try {
                // 1) Get the user's ID token => read custom claims
                const tokenResult = await firebaseUser.getIdTokenResult(true);
                const claims = tokenResult.claims || {};

                // Suppose your custom claims have "firstName", "lastName", "role":
                const { firstName, lastName, role: userRole } = claims;

                // 2) If user has a role => fetch /roles/{role} to get pages/tables
                if (userRole) {
                    const roleSnap = await getDoc(doc(db, 'roles', userRole));
                    if (roleSnap.exists()) {
                        const roleData = roleSnap.data();
                        // Merge user info + role-based pages/tables
                        setUser({
                            firebaseUser,

                            // Basic fields from Firebase user
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,

                            // from custom claims
                            firstName: firstName || '',
                            lastName: lastName || '',
                            role: userRole,

                            // from role doc
                            pages: roleData.pages || [],
                            tables: roleData.tables || {}
                        });
                    } else {
                        // No doc at /roles/{userRole} => fallback
                        setUser({
                            firebaseUser,
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,

                            firstName: firstName || '',
                            lastName: lastName || '',
                            role: userRole,

                            pages: [],
                            tables: {}
                        });
                    }
                } else {
                    // No role => minimal user
                    setUser({
                        firebaseUser,
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,

                        firstName: firstName || '',
                        lastName: lastName || '',
                        role: null,

                        pages: [],
                        tables: {}
                    });
                }
            } catch (err) {
                console.error('Error in onAuthStateChanged processing:', err);
                setUser({
                    firebaseUser,
                    uid: firebaseUser.uid,
                    email: firebaseUser.email
                    // Possibly no claims if reading them failed
                });
            }

            setIsInitialized(true);
        });

        return () => unsubscribe();
    }, []);

    // Provide signIn
    const login = async (email, password) => {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        return userCred.user;
    };

    // Provide signOut
    const logout = async () => {
        await signOut(auth);
        setUser(null);
    };

    return (
        <FirebaseContext.Provider
            value={{
                isLoggedIn: !!user,
                isInitialized,
                user,
                login,
                logout
            }}
        >
            {children}
        </FirebaseContext.Provider>
    );
};

FirebaseProvider.propTypes = {
    children: PropTypes.node
};

export default FirebaseContext;
