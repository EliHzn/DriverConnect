//C:\Users\eliha\firebase\webapp\src\views\chat\ChartHistory.jsx
import PropTypes from 'prop-types';
import React from 'react';

// material-ui
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

// project imports
import { gridSpacing } from 'store/constant';
import { ThemeMode } from 'config';

// ==============================|| CHAT MESSAGE HISTORY ||============================== //

const ChartHistory = ({ data, theme, user }) => (
    <Grid item xs={12}>
        <Grid container spacing={gridSpacing}>
            {data.map((history, index) => (
                <React.Fragment key={index}>
                    {history.from !== user.name ? (
                        <Grid item xs={12}>
                            <Grid container spacing={gridSpacing}>
                                <Grid item xs={2} />
                                <Grid item xs={10}>
                                    <Card
                                        sx={{
                                            display: 'inline-block',
                                            float: 'right',
                                            bgcolor: theme.palette.mode === ThemeMode.DARK ? 'grey.600' : theme.palette.primary.light
                                        }}
                                    >
                                        <CardContent sx={{ p: 2, pb: '16px !important', width: 'fit-content', ml: 'auto' }}>
                                            <Grid container spacing={1}>
                                                <Grid item xs={12}>
                                                    <Typography
                                                        variant="body2"
                                                        color={theme.palette.mode === ThemeMode.DARK ? 'dark.900' : ''}
                                                    >
                                                        {history.text}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={12}>
                                                    <Typography
                                                        align="right"
                                                        variant="subtitle2"
                                                        color={theme.palette.mode === ThemeMode.DARK ? 'dark.900' : ''}
                                                    >
                                                        {history.time}
                                                    </Typography>
                                                </Grid>
                                            </Grid>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </Grid>
                    ) : (
                        <Grid item xs={12}>
                            <Grid container spacing={gridSpacing}>
                                <Grid item xs={12} sm={7}>
                                    <Card
                                        sx={{
                                            display: 'inline-block',
                                            float: 'left',
                                            bgcolor: theme.palette.mode === ThemeMode.DARK ? 'dark.900' : 'secondary.light'
                                        }}
                                    >
                                        <CardContent sx={{ p: 2, pb: '16px !important' }}>
                                            <Grid container spacing={1}>
                                                <Grid item xs={12}>
                                                    <Typography variant="body2">{history.text}</Typography>
                                                </Grid>
                                                <Grid item xs={12}>
                                                    <Typography align="right" variant="subtitle2">
                                                        {history.time}
                                                    </Typography>
                                                </Grid>
                                            </Grid>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </Grid>
                    )}
                </React.Fragment>
            ))}
        </Grid>
    </Grid>
);

ChartHistory.propTypes = {
    theme: PropTypes.object,
    data: PropTypes.array,
    user: PropTypes.object
};

export default ChartHistory;
