// C:\Users\eliha\firebase\webapp\src\routes\index.jsx
import { createHashRouter } from 'react-router-dom';

// routes
import MainRoutes from './MainRoutes';
import LoginRoutes from './LoginRoutes';
import AuthenticationRoutes from './AuthenticationRoutes';

// ==============================|| ROUTING RENDER ||============================== //

const router = createHashRouter([LoginRoutes, AuthenticationRoutes, MainRoutes]);
export default router;
