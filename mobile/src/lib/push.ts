// Push notifications (renewals, deadlines, monthly briefing). Off until Firebase/APNs are set up:
// build with EXPO_PUBLIC_PUSH_ENABLED=1 and add google-services.json / APNs key in EAS.
// The server sends through FCM (adapters/push.ts), so we register the native device token.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { api } from './api';

let done = false;
export async function registerPush() {
  if (done || process.env.EXPO_PUBLIC_PUSH_ENABLED !== '1' || !Device.isDevice) return;
  done = true;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'PayWatch', importance: Notifications.AndroidImportance.DEFAULT });
  }
  const cur = await Notifications.getPermissionsAsync();
  const perm = cur.granted ? cur : await Notifications.requestPermissionsAsync();
  if (!perm.granted) return;
  const tok = await Notifications.getDevicePushTokenAsync();
  await api('/user/push-token', { method: 'POST', body: { token: String(tok.data), platform: Platform.OS } }).catch(() => {});
}
