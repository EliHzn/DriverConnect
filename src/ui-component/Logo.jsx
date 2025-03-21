// C:\Users\eliha\firebase\webapp\src\ui-component\cards\Logo\index.jsx

import React from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
// If you're not using ThemeMode or dark mode checks, you can remove the import below.
import { ThemeMode } from 'config';

// 1) Import your PNG
import logoPng from 'assets/images/logo.png';

// ==============================|| LOGO IMAGE ||============================== //

const Logo = () => {
    const theme = useTheme();

    // If you have dark mode variants:
    // import logoDark from 'assets/images/logo-dark.png';
    // const logoSrc = theme.palette.mode === ThemeMode.DARK ? logoDark : logoPng;
    // else just use a single PNG:
    const logoSrc = logoPng;

    return (
        // Center horizontally and vertically
        <Box
            sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }}
        >
            <img
                src={logoSrc}
                alt="Ben & Nino"
                style={{
                    maxWidth: '90%',
                    objectFit: 'contain'
                }}
            />
        </Box>
    );
};

export default Logo;
