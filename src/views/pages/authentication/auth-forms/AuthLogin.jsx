// C:\Users\eliha\firebase\webapp\src\views\pages\authentication\auth-forms\AuthLogin.jsx

import PropTypes from 'prop-types';
import React from 'react';
import { Link } from 'react-router-dom';

// Material-UI
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import Typography from '@mui/material/Typography';

import * as Yup from 'yup';
import { Formik } from 'formik';

import AnimateButton from 'ui-component/extended/AnimateButton';
import useAuth from 'hooks/useAuth';
import useScriptRef from 'hooks/useScriptRef';

// Icons
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

import axios from 'axios'; // Because TowDispatch uses axios
import { getAuth } from 'firebase/auth';
import { getToken } from 'firebase/messaging';
import { messaging } from 'src/firebase'; // Adjust if your firebase.js is elsewhere

// We'll use the same environment variable style as in TowDispatch
const apiUrl = import.meta.env.VITE_APP_API_URL || '';

// The same VAPID public key used in your other code
const VAPID_PUBLIC_KEY = 'BBpE2HttzMN-Uz_Lb2lcu9IBfredug5y2sz49OPnBQ6eya-tuFBgiLr9kGJGgFfx0V78EHdRtwlM3AJClobnA4s';

const JWTLogin = ({ loginProp, ...others }) => {
  const theme = useTheme();
  const { login } = useAuth(); // your custom hook => signInWithEmailAndPassword
  const scriptedRef = useScriptRef();

  const [checked, setChecked] = React.useState(true);
  const [showPassword, setShowPassword] = React.useState(false);

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };
  const handleMouseDownPassword = (event) => {
    event.preventDefault();
  };

  // Called after successful login to call /api/saveDeviceWithGeo
  const createDeviceServerSide = async () => {
    // 1) Ask permission for notifications
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('User denied notification permission. Skipping device doc creation.');
      return;
    }

    // 2) Get an FCM token
    const fcmToken = await getToken(messaging, { vapidKey: VAPID_PUBLIC_KEY });
    if (!fcmToken) {
      console.log('No FCM token (blocked or error).');
      return;
    }

    // 3) Check or create deviceId in localStorage
    let deviceId = localStorage.getItem('myDeviceId');
    if (!deviceId) {
      deviceId = 'dev_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('myDeviceId', deviceId);
    }

    // 4) Obtain the user's ID token for the Authorization header
    const firebaseAuth = getAuth();
    const user = firebaseAuth.currentUser;
    if (!user) {
      console.log('No Firebase user after login?');
      return;
    }
    const idToken = await user.getIdToken(true);

    // 5) Post to your server => /api/saveDeviceWithGeo
    const headers = { Authorization: `Bearer ${idToken}` };
    const payload = { deviceId, token: fcmToken };

    try {
      await axios.post(`${apiUrl}/api/saveDeviceWithGeo`, payload, { headers });
      console.log('Successfully called /api/saveDeviceWithGeo');
    } catch (err) {
      console.error('Error calling /api/saveDeviceWithGeo:', err);
    }
  };

  return (
    <Formik
      initialValues={{
        email: '',
        password: '',
        submit: null
      }}
      validationSchema={Yup.object().shape({
        email: Yup.string().email('Must be a valid email').max(255).required('Email is required'),
        password: Yup.string().max(255).required('Password is required')
      })}
      onSubmit={async (values, { setErrors, setStatus, setSubmitting }) => {
        try {
          // 1) Attempt to log in the user
          await login(values.email, values.password);

          // 2) On success => gather device info server-side
          await createDeviceServerSide();

          // 3) Wrap up Formik
          if (scriptedRef.current) {
            setStatus({ success: true });
            setSubmitting(false);
          }
        } catch (err) {
          console.error('Login error:', err);
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
          <FormControl
            fullWidth
            error={Boolean(touched.email && errors.email)}
            sx={{ ...theme.typography.customInput }}
          >
            <InputLabel htmlFor="outlined-adornment-email-login">Email Address / Username</InputLabel>
            <OutlinedInput
              id="outlined-adornment-email-login"
              type="email"
              value={values.email}
              name="email"
              onBlur={handleBlur}
              onChange={handleChange}
              inputProps={{}}
            />
            {touched.email && errors.email && (
              <FormHelperText error id="standard-weight-helper-text-email-login">
                {errors.email}
              </FormHelperText>
            )}
          </FormControl>

          <FormControl
            fullWidth
            error={Boolean(touched.password && errors.password)}
            sx={{ ...theme.typography.customInput }}
          >
            <InputLabel htmlFor="outlined-adornment-password-login">Password</InputLabel>
            <OutlinedInput
              id="outlined-adornment-password-login"
              type={showPassword ? 'text' : 'password'}
              value={values.password}
              name="password"
              onBlur={handleBlur}
              onChange={handleChange}
              endAdornment={
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={handleClickShowPassword}
                    onMouseDown={handleMouseDownPassword}
                    edge="end"
                    size="large"
                    sx={{ color: 'inherit' }}
                  >
                    {showPassword ? <Visibility /> : <VisibilityOff />}
                  </IconButton>
                </InputAdornment>
              }
              inputProps={{}}
              label="Password"
            />
            {touched.password && errors.password && (
              <FormHelperText error id="standard-weight-helper-text-password-login">
                {errors.password}
              </FormHelperText>
            )}
          </FormControl>

          <Grid container alignItems="center" justifyContent="space-between">
            <Grid item>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={checked}
                    onChange={(event) => setChecked(event.target.checked)}
                    name="checked"
                    color="primary"
                  />
                }
                label="Keep me logged in"
              />
            </Grid>
            <Grid item>
              <Typography
                variant="subtitle1"
                component={Link}
                to={loginProp ? `/pages/forgot-password/forgot-password${loginProp}` : '/forgot'}
                color="secondary"
                sx={{ textDecoration: 'none' }}
              >
                Forgot Password?
              </Typography>
            </Grid>
          </Grid>

          {errors.submit && (
            <Box sx={{ mt: 3 }}>
              <FormHelperText error>{errors.submit}</FormHelperText>
            </Box>
          )}

          <Box sx={{ mt: 2 }}>
            <AnimateButton>
              <Button
                color="secondary"
                disabled={isSubmitting}
                fullWidth
                size="large"
                type="submit"
                variant="contained"
              >
                Sign In
              </Button>
            </AnimateButton>
          </Box>
        </form>
      )}
    </Formik>
  );
};

JWTLogin.propTypes = {
  loginProp: PropTypes.number
};

export default JWTLogin;
