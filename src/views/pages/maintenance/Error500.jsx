import { Link } from 'react-router-dom';

// material-ui
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// project imports
import { DASHBOARD_PATH } from 'config';
import AnimateButton from 'ui-component/extended/AnimateButton';
import { gridSpacing } from 'store/constant';

// assets
import HomeTwoToneIcon from '@mui/icons-material/HomeTwoTone';
import error500 from 'assets/images/maintenance/500-error.svg';

// ==============================|| ERROR PAGE ||============================== //

const Error = () => (
    <Grid container direction="column" alignItems="center" justifyContent="center" sx={{ minHeight: '100vh' }} spacing={gridSpacing}>
        <Grid item xs={12}>
            <Box sx={{ width: { xs: 350, sm: 396 } }}>
                <img src={error500} alt="mantis" style={{ height: '100%', width: '100%' }} />
            </Box>
        </Grid>
        <Grid item xs={12}>
            <Stack justifyContent="center" alignItems="center" spacing={gridSpacing} sx={{ p: 1.5 }}>
                <Typography variant="h1">Internal Server Error</Typography>
                <Typography variant="body2" align="center">
                    Server error 500. we fixing the problem. please try again at a later stage.
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

export default Error;
