'use client';

// Native bridge — all calls no-op on the web, so the same codebase runs on
// web (Vercel) and inside the Capacitor app. Guarded by Capacitor.isNativePlatform().

import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { PushNotifications } from '@capacitor/push-notifications';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';

export const isNative = () => Capacitor.isNativePlatform();
export const platform = () => Capacitor.getPlatform();

// Called once on app mount. Styles the status bar, hides the splash, and wires
// the biometric re-lock when the app returns to the foreground.
export async function initNative(onResume: () => void): Promise<void> {
  if (!isNative()) return;
  try { await StatusBar.setStyle({ style: Style.Dark }); } catch {}
  try { await StatusBar.setBackgroundColor({ color: '#07211D' }); } catch {}
  try { await SplashScreen.hide(); } catch {}
  try {
    App.addListener('appStateChange', ({ isActive }) => { if (isActive) onResume(); });
  } catch {}
}

// Returns true if biometrics aren't available (so we don't lock people out) or
// the user authenticates successfully.
export async function unlock(): Promise<boolean> {
  if (!isNative()) return true;
  try {
    const info = await BiometricAuth.checkBiometry();
    if (!info.isAvailable) return true; // no biometrics enrolled → don't block
    await BiometricAuth.authenticate({
      reason: 'Unlock PayWatch',
      cancelTitle: 'Cancel',
      iosFallbackTitle: 'Use passcode',
      androidTitle: 'Unlock PayWatch',
      androidSubtitle: 'Confirm it\'s you',
      allowDeviceCredential: true,
    });
    return true;
  } catch {
    return false;
  }
}

export function tapHaptic(): void {
  if (isNative()) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

// Registers for push and hands the device token back so we can store it server-side.
export async function registerPush(onToken: (token: string, platform: string) => void): Promise<void> {
  if (!isNative()) return;
  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt') perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return;
    await PushNotifications.register();
    await PushNotifications.addListener('registration', (t) => onToken(t.value, Capacitor.getPlatform()));
    await PushNotifications.addListener('registrationError', (e) => console.warn('push reg error', e));
  } catch (e) {
    console.warn('push setup failed', e);
  }
}
