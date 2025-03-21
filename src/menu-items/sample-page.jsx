// This is example of menu item without group for horizontal layout. There will be no children.

// third-party
import { FormattedMessage } from 'react-intl';

// assets
import { IconBrandChrome } from '@tabler/icons-react';

// ==============================|| MENU ITEMS - dashboard PAGE ||============================== //

const icons = {
    IconBrandChrome
};
const samplePage = {
    id: 'dashboard-page',
    title: <FormattedMessage id="dashboard-page" />,
    icon: icons.IconBrandChrome,
    type: 'group',
    url: '/dashboard-page'
};

export default samplePage;
