// menu-firestore-adapter.js

import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase'; // Adjust path to your firebase config
import { IconLayoutDashboard } from '@tabler/icons-react';

/**
 * Dynamically import a Tabler icon by name, e.g. "IconBolt" or "IconAlien".
 * If the import fails, we return IconLayoutDashboard as a fallback.
 */
async function dynamicImportIcon(iconName) {
    if (!iconName) return IconLayoutDashboard;
    try {
        // We append ".js" because some bundlers need the explicit file reference
        const mod = await import(`@tabler/icons-react/${iconName}.js`);
        // Try to return the named export (e.g. mod.IconBolt). If not found, fallback to mod.default
        return mod[iconName] || mod.default || IconLayoutDashboard;
    } catch (e) {
        console.warn(`Failed to load icon "${iconName}", using fallback.`, e);
        return IconLayoutDashboard;
    }
}

/**
 * Fetch the "menu" collection from Firestore, dynamically load icons,
 * and produce an array shaped like Berry's "group" / "item" structure.
 *
 * @param {string[]} userPages An array of page names the user can access
 *                             (e.g. ["dashboard", "settings"]).
 */
export async function fetchMenuFromFirestore(userPages = []) {
    // 1. Query "menu" collection by "order" ascending
    const q = query(collection(db, 'menu'), orderBy('order', 'asc'));
    const snap = await getDocs(q);

    // 2. Collect docs, then filter out items if user doesn't have that page
    const allDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const filteredDocs = allDocs.filter((data) => {
        // If the doc has no pageName, allow it by default
        // Otherwise, only allow if userPages includes it
        return !data.pageName || userPages.includes(data.pageName);
    });

    // 3. For each filtered doc, dynamically import the icon, build Berry's "item" object
    const itemPromises = filteredDocs.map(async (data) => {
        const usedIcon = await dynamicImportIcon(data.icon);
        return {
            id: data.id,
            type: data.type || 'item',
            title: data.title || 'Untitled',
            icon: usedIcon,
            url: data.url || '',
            pageName: data.pageName || '',
            children: [] // or fill from data if you want nesting
        };
    });

    // Wait for all icons to finish loading
    const itemArray = await Promise.all(itemPromises);

    // 4. Wrap them in a single "group" object so Berry sees one group with multiple child items
    const finalMenu = [
        {
            id: 'dynamic-group',
            type: 'group',
            children: itemArray
        }
    ];

    return finalMenu;
}
