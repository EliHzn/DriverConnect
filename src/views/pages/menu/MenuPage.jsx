// C:\Users\eliha\firebase\webapp\src\views\pages\menu\MenuPage.jsx
import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from 'firebase.js';
import useAuth from 'hooks/useAuth';

function MenuPage() {
    const { user, isInitialized } = useAuth();
    const [menuItems, setMenuItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isInitialized) return; // Wait for auth to initialize
        if (!user) {
            // user not signed in
            setLoading(false);
            return;
        }

        // user is definitely signed in now
        const fetchMenu = async () => {
            try {
                const snap = await getDocs(collection(db, 'menu'));
                const arr = [];
                snap.forEach((doc) => arr.push({ id: doc.id, ...doc.data() }));
                setMenuItems(arr);
            } catch (err) {
                console.error('Error fetching menu:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchMenu();
    }, [isInitialized, user]);

    if (loading) {
        return <div>Loading menu...</div>;
    }

    if (menuItems.length === 0) {
        return <div>No menu items found. (Or insufficient permissions)</div>;
    }

    return (
        <ul>
            {menuItems.map((m) => (
                <li key={m.id}>{m.title}</li>
            ))}
        </ul>
    );
}

export default MenuPage;
