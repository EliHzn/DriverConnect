import { Link } from 'react-router-dom';

// material-ui
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CardMedia from '@mui/material/CardMedia';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// project imports
import { DASHBOARD_PATH } from 'config';
import AnimateButton from 'ui-component/extended/AnimateButton';
import { ThemeMode } from 'config';

import { gridSpacing } from 'store/constant';

// assets
import HomeTwoToneIcon from '@mui/icons-material/HomeTwoTone';

import imageBackground from 'assets/images/maintenance/img-error-bg.svg';
import imageDarkBackground from 'assets/images/maintenance/img-error-bg-dark.svg';
import imageBlue from 'assets/images/maintenance/img-error-blue.svg';
import imageText from 'assets/images/maintenance/img-error-text.svg';
import imagePurple from 'assets/images/maintenance/img-error-purple.svg';

// ==============================|| ERROR PAGE ||============================== //

const Error = () => {
    const theme = useTheme();
    const imageSX = { position: 'absolute', top: 0, left: 0, width: '100%' };

    return (
        <Grid container direction="column" alignItems="center" justifyContent="center" sx={{ minHeight: '100vh' }} spacing={gridSpacing}>
            <Grid item xs={12}>
                <Box sx={{ maxWidth: { xs: 350, sm: 580, md: 720 }, margin: '0 auto', position: 'relative' }}>
                    <CardMedia
                        component="img"
                        image={theme.palette.mode === ThemeMode.DARK ? imageDarkBackground : imageBackground}
                        title="Slider5 image"
                    />
                    <CardMedia
                        component="img"
                        image={imageText}
                        title="Slider 1 image"
                        sx={{ ...imageSX, animation: '3s bounce ease-in-out infinite' }}
                    />
                    <CardMedia
                        component="img"
                        image={imageBlue}
                        title="Slider 2 image"
                        sx={{ ...imageSX, animation: '15s bounce ease-in-out infinite' }}
                    />
                    <CardMedia
                        component="img"
                        image={imagePurple}
                        title="Slider 3 image"
                        sx={{ ...imageSX, animation: '12s bounce ease-in-out infinite' }}
                    />
                </Box>
            </Grid>
            <Grid item xs={12}>
                <Stack justifyContent="center" alignItems="center" spacing={gridSpacing} sx={{ p: 1.5, maxWidth: 350 }}>
                    <Typography variant="h1">Something is wrong</Typography>
                    <Typography variant="body2" align="center">
                        The page you are looking was moved, removed, renamed, or might never exist!
                    </Typography>
                    <AnimateButton>
                        <Button variant="contained" size="large" component={Link} to={DASHBOARD_PATH}>
                            <HomeTwoToneIcon sx={{ fontSize: '1.3rem', mr: 0.75 }} /> Home
                        </Button>
                    </AnimateButton>
                </Stack>
            </Grid>
        </Grid>
    );
};

export default Error;
