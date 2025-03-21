// C:\Users\eliha\firebase\webapp\src\routing\MainRoutes.js
// or wherever your main routes file is located.

import { lazy } from 'react';

// project imports
import AuthGuard from 'utils/route-guard/AuthGuard';
import RoleGuard from 'utils/route-guard/RoleGuard';
import MiniDrawerLayout from 'layout/MainLayout';
// ^-- We'll rename the new mini-drawer code "MainLayout.jsx" so it replaces old usage

import Loadable from 'ui-component/Loadable';
import Unauthorized from 'views/pages/unauthorized/Unauthorized';
import MenuManager from 'views/pages/menu/MenuManager';
import MenuPage from 'views/pages/menu/MenuPage';
import RoleManager from 'views/pages/admin/RoleManager';
import UserManager from 'views/pages/admin/UserManager';
import CompanyManager from 'views/pages/admin/CompanyManager';
import AccountsManager from 'views/pages/operations/AccountsManager';
import TowManager from 'views/pages/towManager/TowManager';
import TowJobs from 'views/pages/towManager/TowList';
import TowDispatch from 'views/pages/towManager/TowDispatch';

// 1) Import AccountDetails
import AccountDetails from 'views/pages/operations/AccountDetails';

// Example loaded page
const Dashboard = Loadable(lazy(() => import('views/dashboard')));

// ==============================|| MAIN ROUTING ||============================== //

const MainRoutes = {
    path: '/',
    element: (
        <AuthGuard>
            {/* Here we use the new mini-drawer-based layout */}
            <MiniDrawerLayout />
        </AuthGuard>
    ),
    children: [
        {
            path: '/',
            element: <Dashboard />
        },
        {
            path: '/dashboard',
            element: (
                <RoleGuard pageName="dashboard">
                    <Dashboard />
                </RoleGuard>
            )
        },
        {
            path: '/menu-manager',
            element: (
                <RoleGuard pageName="menu-manager">
                    <MenuManager />
                </RoleGuard>
            )
        },
        {
            path: '/unauthorized',
            element: <Unauthorized />
        },
        {
            path: '/menu',
            element: <MenuPage />
        },
        {
            path: '/role-manager',
            element: (
                <RoleGuard pageName="role-manager">
                    <RoleManager />
                </RoleGuard>
            )
        },
        {
            path: '/user-manager',
            element: (
                <RoleGuard pageName="user-manager">
                    <UserManager />
                </RoleGuard>
            )
        },
        {
            path: '/company-manager',
            element: (
                <RoleGuard pageName="company-manager">
                    <CompanyManager />
                </RoleGuard>
            )
        },
        {
            path: '/accounts-manager',
            element: (
                <RoleGuard pageName="accounts-manager">
                    <AccountsManager />
                </RoleGuard>
            )
        },
        // 2) Add the new route for AccountDetails
        {
            path: '/account/:docId',
            element: (
                <RoleGuard pageName="accounts-manager">
                    <AccountDetails />
                </RoleGuard>
            )
        },
        {
            path: '/tow-manager',
            element: (
                <RoleGuard pageName="tow-manager">
                    <TowManager />
                </RoleGuard>
            )
        },
        {
            path: '/tow-jobs',
            element: (
                <RoleGuard pageName="tow-jobs">
                    <TowJobs />
                </RoleGuard>
            )
        },
        {
            path: '/tow-jobs/new',
            element: (
                <RoleGuard pageName="tow-jobs">
                    <TowManager />
                </RoleGuard>
            )
        },
        {
            path: '/tow-jobs/:docId',
            element: (
                <RoleGuard pageName="tow-jobs">
                    <TowManager />
                </RoleGuard>
            )
        },
        {
            path: '/dispatch',
            element: (
                <RoleGuard pageName="dispatch">
                    <TowDispatch />
                </RoleGuard>
            )
        }
    ]
};

export default MainRoutes;
