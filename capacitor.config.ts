import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.inkahobby.app',
  appName: 'InkaHobby',
  webDir: 'out',
  server: {
    // In development, point to the dev server
    // In production, this should be empty or point to your deployed URL
    url: process.env.CAPACITOR_SERVER_URL || '',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#111827',
      showSpinner: true,
      spinnerColor: '#F59E0B',
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#111827',
    },
  },
};

export default config;
