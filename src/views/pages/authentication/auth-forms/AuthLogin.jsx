// C:\Users\eliha\firebase\webapp\src\views\pages\authentication\auth-forms\AuthLogin.jsx

import PropTypes from 'prop-types';
import React from 'react';
import { Link } from 'react-router-dom';

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

import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

import axios from 'axios';
import { getAuth } from 'firebase/auth';
import { getToken } from 'firebase/messaging';
import { messaging } from 'src/firebase';

const apiUrl = import.meta.env.VITE_APP_API_URL || '';
const VAPID_PUBLIC_KEY = 'BBpE2HttzMN-Uz_Lb2lcu9IBfredug5y2sz49OPnBQ6eya-tuFBgiLr9kGJGgFfx0V78EHdRtwlM3AJClobnA4s';

const JWTLogin = ({ loginProp, ...others }) => {
  const theme = useTheme();
  const { login } = useAuth();
  const scriptedRef = useScriptRef();

  const [checked, setChecked] = React.useState(true);
  const [showPassword, setShowPassword] = React.useState(false);

  const handleClickShowPassword = () => setShowPassword(!showPassword);
  const handleMouseDownPassword = (event) => event.preventDefault();

  const createDeviceServerSide = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Notification permission not granted.');
        return;
      }

      const fcmToken = await getToken(messaging, { vapidKey: VAPID_PUBLIC_KEY });
      if (!fcmToken) {
        console.log('FCM token unavailable.');
        return;
      }

      let deviceId = localStorage.getItem('myDeviceId');
      if (!deviceId) {
        deviceId = 'dev_' + Math.random().toString(36).substring(2, 10);
        localStorage.setItem('myDeviceId', deviceId);
      }

      const user = getAuth().currentUser;
      if (!user) {
        console.log('No Firebase user after login.');
        return;
      }

      const idToken = await user.getIdToken(true);
      const headers = { Authorization: `Bearer ${idToken}` };
      const payload = { deviceId, token: fcmToken };

      await axios.post(`${apiUrl}/api/saveDeviceWithGeo`, payload, { headers });
      console.log('✅ /api/saveDeviceWithGeo succeeded.');
    } catch (err) {
      console.error('❌ Error in createDeviceServerSide:', err);
    }
  };

  return (
    <Formik
      initialValues={{ email: '', password: '', submit: null }}
      validationSchema={Yup.object().shape({
        email: Yup.string().email('Must be a valid email').max(255).required('Email is required'),
        password: Yup.string().max(255).required('Password is required')
      })}
      onSubmit={async (values, { setErrors, setStatus, setSubmitting }) => {
        console.log("🟢 Login button clicked with:", values);
        try {
          console.log("🔐 Attempting Firebase login...");
          await login(values.email, values.password);
          console.log("✅ Firebase login successful");

          console.log("📡 Registering device for notifications...");
          await createDeviceServerSide();

          if (scriptedRef.current) {
            setStatus({ success: true });
            setSubmitting(false);
          }
        } catch (err) {
          console.error("❌ Login failed:", err);
          alert("Login failed: " + (err.message || "Unknown error"));
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
            <InputLabel htmlFor="outlined-adornment-email-login">Email Address</InputLabel>
            <OutlinedInput
              id="outlined-adornment-email-login"
              type="email"
              value={values.email}
              name="email"
              onBlur={handleBlur}
              onChange={handleChange}
            />
            {touched.email && errors.email && (
              <FormHelperText error id="email-error-text">
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
                    onClick={handleClickShowPassword}
                    onMouseDown={handleMouseDownPassword}
                    edge="end"
                    size="large"
                  >
                    {showPassword ? <Visibility /> : <VisibilityOff />}
                  </IconButton>
                </InputAdornment>
              }
              label="Password"
            />
            {touched.password && errors.password && (
              <FormHelperText error id="password-error-text">
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
