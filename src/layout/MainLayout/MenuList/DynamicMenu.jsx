import { memo, useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from 'firebase.js'; // Adjust the path to your firebase.js if needed

// material-ui
import List from '@mui/material/List';
import Divider from '@mui/material/Divider';

// project imports
import NavItem from './NavItem'; // or wherever your NavItem is located

const DynamicMenu = () => {
    const [menuItems, setMenuItems] = useState([]);

    useEffect(() => {
        const fetchMenu = async () => {
            try {
                const q = query(collection(db, 'menu'), orderBy('order', 'asc'));
                const snap = await getDocs(q);
                const tempItems = [];
                snap.forEach((doc) => {
                    tempItems.push({ id: doc.id, ...doc.data() });
                });
                setMenuItems(tempItems);
            } catch (error) {
                console.error('Error fetching menu items:', error);
            }
        };

        fetchMenu();
    }, []);

    return (
        <>
            {menuItems.map((item, idx) => (
                <List key={item.id}>
                    <NavItem item={item} level={1} />
                    {idx !== menuItems.length - 1 && <Divider sx={{ py: 0.5 }} />}
                </List>
            ))}
        </>
    );
};

export default memo(DynamicMenu);
