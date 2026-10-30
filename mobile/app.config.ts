// PayWatch native app config (iOS + Android). One source of truth for store-facing
// metadata, permissions (with the exact wording reviewers read), and the iOS privacy manifest.
import type { ExpoConfig } from 'expo/config';

const MIC = 'PayWatch uses the microphone only while you talk to the voice assistant, so you can ask about your money hands-free. Audio is not stored.';
const SPEECH = 'PayWatch turns what you say into text so the voice assistant can answer your money questions.';
const FACE = 'Use Face ID to unlock PayWatch and keep your financial data private.';

const config: ExpoConfig = {
  name: 'PayWatch',
  slug: 'paywatch',
  scheme: 'paywatch',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  backgroundColor: '#07211D',
  ios: {
    bundleIdentifier: 'in.paywatch.app',
    supportsTablet: false,
    buildNumber: '1',
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      NSMicrophoneUsageDescription: MIC,
      NSSpeechRecognitionUsageDescription: SPEECH,
      NSFaceIDUsageDescription: FACE,
      ITSAppUsesNonExemptEncryption: false,
    },
    // Apple privacy manifest — required-reason APIs + what we collect (matches the App Privacy label).
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime', NSPrivacyAccessedAPITypeReasons: ['35F9.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace', NSPrivacyAccessedAPITypeReasons: ['E174.1'] },
      ],
      NSPrivacyCollectedDataTypes: [
        { NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeName', NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] },
        { NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeEmailAddress', NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] },
        { NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePhoneNumber', NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] },
        { NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeOtherFinancialInfo', NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] },
        { NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeAudioData', NSPrivacyCollectedDataTypeLinked: false, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] },
        { NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeOtherUserContent', NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] },
        { NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeUserID', NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] },
      ],
    },
  },
  android: {
    package: 'in.paywatch.app',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundImage: './assets/adaptive-bg.png',
      monochromeImage: './assets/adaptive-mono.png',
      backgroundColor: '#07211D',
    },
    // Only what we use. Everything else a library might add is blocked.
    permissions: ['android.permission.RECORD_AUDIO', 'android.permission.USE_BIOMETRIC', 'android.permission.POST_NOTIFICATIONS'],
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_PHONE_STATE',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.CAMERA',
      // expo-audio adds these for background playback; we only play while the app is open.
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
    ],
    allowBackup: false, // financial data: never in device cloud backups
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-localization',
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 160, resizeMode: 'contain', backgroundColor: '#07211D' }],
    ['expo-audio', { microphonePermission: MIC, recordAudioAndroid: true, enableBackgroundPlayback: false, enableBackgroundRecording: false }],
    ['expo-speech-recognition', { microphonePermission: MIC, speechRecognitionPermission: SPEECH, androidSpeechServicePackages: ['com.google.android.googlequicksearchbox', 'com.google.android.as'] }],
    ['expo-local-authentication', { faceIDPermission: FACE }],
    ['expo-notifications', { icon: './assets/notification-icon.png', color: '#2FBC9B' }],
    // SDK levels: Expo SDK 58 defaults already meet Google Play's current target-API requirement.
  ],
  experiments: { typedRoutes: false },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://api.paywatch.in/v1',
    webUrl: 'https://paywatch.in',
    eas: { projectId: process.env.EAS_PROJECT_ID || undefined },
  },
};

export default config;
