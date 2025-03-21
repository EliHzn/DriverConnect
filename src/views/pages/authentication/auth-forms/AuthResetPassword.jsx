import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import Typography from '@mui/material/Typography';

// third party
import * as Yup from 'yup';
import { Formik } from 'formik';

// project imports
import useScriptRef from 'hooks/useScriptRef';
import AnimateButton from 'ui-component/extended/AnimateButton';
import { strengthColor, strengthIndicator } from 'utils/password-strength';

import { dispatch } from 'store';
import { openSnackbar } from 'store/slices/snackbar';

// assets
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

// ========================|| FIREBASE - RESET PASSWORD ||======================== //

const AuthResetPassword = ({ ...others }) => {
    const theme = useTheme();
    const navigate = useNavigate();
    const scriptedRef = useScriptRef();

    const [showPassword, setShowPassword] = React.useState(false);
    const [strength, setStrength] = React.useState(0);
    const [level, setLevel] = React.useState();

    const handleClickShowPassword = () => {
        setShowPassword(!showPassword);
    };

    const handleMouseDownPassword = (event) => {
        event.preventDefault();
    };

    const changePassword = (value) => {
        const temp = strengthIndicator(value);
        setStrength(temp);
        setLevel(strengthColor(temp));
    };

    useEffect(() => {
        changePassword('');
    }, []);

    return (
        <Formik
            initialValues={{
                password: '',
                confirmPassword: '',
                submit: null
            }}
            validationSchema={Yup.object().shape({
                password: Yup.string().max(255).required('Password is required'),
                confirmPassword: Yup.string()
                    .required('Confirm Password is required')
                    .test(
                        'confirmPassword',
                        'Both Password must be match!',
                        (confirmPassword, yup) => yup.parent.password === confirmPassword
                    )
            })}
            onSubmit={async (values, { setErrors, setStatus, setSubmitting }) => {
                try {
                    // password reset
                    if (scriptedRef.current) {
                        setStatus({ success: true });
                        setSubmitting(false);

                        dispatch(
                            openSnackbar({
                                open: true,
                                message: 'Successfuly reset password.',
                                variant: 'alert',
                                alert: {
                                    color: 'success'
                                },
                                close: false
                            })
                        );

                        setTimeout(() => {
                            navigate('/login', { replace: true });
                        }, 1500);
                    }
                } catch (err) {
                    console.error(err);
                    if (scriptedRef.current) {
                        setStatus({ success: false });
                        setErrors({ submit: err.message });
                        setSubmitting(false);
                    }
                }
            }}
        >
            {({ errors, handleBlur, handleChange, handleSubmit, isSubmitting, touched, values }) => (
                <form noValidate onSubmit={handleSubmit} {...others}>
                    <FormControl fullWidth error={Boolean(touched.password && errors.password)} sx={{ ...theme.typography.customInput }}>
                        <InputLabel htmlFor="outlined-adornment-password-reset">Password</InputLabel>
                        <OutlinedInput
                            id="outlined-adornment-password-reset"
                            type={showPassword ? 'text' : 'password'}
                            value={values.password}
                            name="password"
                            onBlur={handleBlur}
                            onChange={(e) => {
                                handleChange(e);
                                changePassword(e.target.value);
                            }}
                            endAdornment={
                                <InputAdornment position="end">
                                    <IconButton
                                        aria-label="toggle password visibility"
                                        onClick={handleClickShowPassword}
                                        onMouseDown={handleMouseDownPassword}
                                        edge="end"
                                        size="large"
                                    >
                                        {showPassword ? <Visibility /> : <VisibilityOff />}
                                    </IconButton>
                                </InputAdornment>
                            }
                            inputProps={{}}
                        />
                    </FormControl>
                    {touched.password && errors.password && (
                        <FormControl fullWidth>
                            <FormHelperText error id="standard-weight-helper-text-reset">
                                {errors.password}
                            </FormHelperText>
                        </FormControl>
                    )}
                    {strength !== 0 && (
                        <FormControl fullWidth>
                            <Box sx={{ mb: 2 }}>
                                <Grid container spacing={2} alignItems="center">
                                    <Grid item>
                                        <Box sx={{ width: 85, height: 8, borderRadius: '7px', bgcolor: level?.color }} />
                                    </Grid>
                                    <Grid item>
                                        <Typography variant="subtitle1" fontSize="0.75rem">
                                            {level?.label}
                                        </Typography>
                                    </Grid>
                                </Grid>
                            </Box>
                        </FormControl>
                    )}

                    <FormControl
                        fullWidth
                        error={Boolean(touched.confirmPassword && errors.confirmPassword)}
                        sx={{ ...theme.typography.customInput }}
                    >
                        <InputLabel htmlFor="outlined-adornment-confirm-password">Confirm Password</InputLabel>
                        <OutlinedInput
                            id="outlined-adornment-confirm-password"
                            type="password"
                            value={values.confirmPassword}
                            name="confirmPassword"
                            label="Confirm Password"
                            onBlur={handleBlur}
                            onChange={handleChange}
                            inputProps={{}}
                        />
                    </FormControl>

                    {touched.confirmPassword && errors.confirmPassword && (
                        <FormControl fullWidth>
                            <FormHelperText error id="standard-weight-helper-text-confirm-password">
                                {' '}
                                {errors.confirmPassword}{' '}
                            </FormHelperText>
                        </FormControl>
                    )}

                    {errors.submit && (
                        <Box sx={{ mt: 3 }}>
                            <FormHelperText error>{errors.submit}</FormHelperText>
                        </Box>
                    )}
                    <Box sx={{ mt: 1 }}>
                        <AnimateButton>
                            <Button
                                disableElevation
                                disabled={isSubmitting}
                                fullWidth
                                size="large"
                                type="submit"
                                variant="contained"
                                color="secondary"
                            >
                                Reset Password
                            </Button>
                        </AnimateButton>
                    </Box>
                </form>
            )}
        </Formik>
    );
};

export default AuthResetPassword;
