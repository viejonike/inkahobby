import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.inkahobby.app',
  appName: 'InkaHobby',
  webDir: 'out',
  server: {
    // Use https scheme so API calls to the cloud server work with CORS
    androidScheme: 'https',
    // No need to set a server URL here - the app uses NEXT_PUBLIC_API_URL at build time
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a1a2e',
      showSpinner: false,
    },
  },
  android: {
    allowMixedContent: false, // No mixed content needed - everything goes through HTTPS
  },
};

export default config;
