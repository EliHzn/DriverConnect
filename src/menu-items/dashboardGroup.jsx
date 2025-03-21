// C:\Users\eliha\firebase\webapp\src\menu-items\dashboardGroup.jsx
// third-party
import { FormattedMessage } from 'react-intl';

// Tabler icons
import { IconLayoutDashboard, IconRocket, IconFlame, IconBolt, IconAlien, IconGhost } from '@tabler/icons-react';

// ==============================|| MENU ITEMS - DASHBOARD GROUP ||============================== //

// You can add or remove icons as you like
const icons = {
    IconLayoutDashboard,
    IconFlame,
    IconBolt,
    IconAlien,
    IconGhost
};

const dashboardGroup = {
    id: 'cool-dashboard-group',
    title: <FormattedMessage id="dashboard" />,

    type: 'group',
    // We'll have 5 child items, each with a different icon
    children: [
        {
            id: 'dashboard',
            title: 'Dashboard',
            type: 'item',
            icon: icons.IconLayoutDashboard,
            url: '/dashboard'
        },
        {
            id: 'dashboard-2',
            title: 'Dashboard 2',
            type: 'item',
            icon: icons.IconFlame,
            url: '/dashboard2'
        },
        {
            id: 'dashboard-3',
            title: 'Dashboard 3',
            type: 'item',
            icon: icons.IconBolt,
            url: '/dashboard3'
        },
        {
            id: 'dashboard-4',
            title: 'Dashboard 4',
            type: 'item',
            icon: icons.IconAlien,
            url: '/dashboard4'
        },
        {
            id: 'dashboard-5',
            title: 'Dashboard 5',
            type: 'item',
            icon: icons.IconGhost,
            url: '/dashboard5'
        }
    ]
};

export default dashboardGroup;
