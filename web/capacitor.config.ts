import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.paywatch.app',
  appName: 'PayWatch',
  webDir: 'out',
  backgroundColor: '#07211D',
  ios: { backgroundColor: '#07211D', contentInset: 'always' },
  android: { backgroundColor: '#07211D' },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#07211D',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
};

export default config;
