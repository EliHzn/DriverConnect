// C:\Users\eliha\firebase\webapp\src\index.jsx


import { createRoot } from 'react-dom/client';




// third party
import { Provider } from 'react-redux';

// project imports
import App from 'App';
import { store } from 'store';
import * as serviceWorker from 'serviceWorker';
import reportWebVitals from 'reportWebVitals';
import { ConfigProvider } from 'contexts/ConfigContext';

// styles
import 'assets/scss/style.scss';

// fonts
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';

// ==============================|| REACT DOM RENDER ||============================== //

const root = createRoot(document.getElementById('root'));

root.render(
    <Provider store={store}>
        <ConfigProvider>
            <App />
        </ConfigProvider>
    </Provider>
);

// If offline support is needed, change to: serviceWorker.register();
serviceWorker.unregister();

// Log web vitals (optional)
reportWebVitals();
