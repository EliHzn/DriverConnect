// capacitor.config.js - CommonJS format (compatible with Node)
/// <reference types="@capacitor/cli" />  /* Optionally enable type info in VSCode */
/** @type {import('@capacitor/cli').CapacitorConfig} */  // JSDoc for type checking
const config = {
  appId: 'com.benandnino.driverconnect',
  appName: 'DriverConnect',
  webDir: 'dist',        // path to built web assets
  bundledWebRuntime: false,
  // Example: using an environment variable (allowed in Appflow)
  // plugins: {
  //   LiveUpdates: {
  //     channel: process.env.LIVE_UPDATE_CHANNEL_NAME  // dynamic config
  //   }
  // }
};
module.exports = config;
