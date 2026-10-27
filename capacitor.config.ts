import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ticketplaster.flontmie',
  appName: 'Flontmie',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'flontmie.ticketplaster.com',
    allowNavigation: [
      'flontmie.ticketplaster.com',
      '*.ticketplaster.com',
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#030303',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#030303',
      overlaysWebView: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#EF4444',
    },
  },
};

export default config;
