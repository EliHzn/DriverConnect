// capacitor.config.js - CommonJS format (compatible with Node)
/// <reference types="@capacitor/cli" />  /* Optionally enable type info in VSCode */
/** @type {import('@capacitor/cli').CapacitorConfig} */  // JSDoc for type checking
const config = {
  appId: 'com.benandnino.driverapp',
  appName: 'DriverConnect',
  webDir: 'dist',        // path to built web assets
  bundledWebRuntime: false
};

module.exports = config;
