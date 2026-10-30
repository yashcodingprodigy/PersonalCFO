// Root: providers, auth gate (login → onboarding → app), splash, optional biometric lock.
import React, { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/lib/auth';
import { LanguageProvider, useLang } from '@/lib/i18n';
import { AssistantProvider } from '@/lib/assistant';
import { C } from '@/lib/theme';
import { BIOLOCK_KEY } from '@/lib/prefs';
import { Button, H2, Orb, Soft } from '@/components/ui';
import { GuideCard } from '@/components/GuideCard';
import { registerPush } from '@/lib/push';

SplashScreen.preventAutoHideAsync().catch(() => {});
SystemUI.setBackgroundColorAsync(C.paper).catch(() => {});


function Gate() {
  const { status, needsOnboarding } = useAuth();
  const { lang } = useLang();
  const inAppEarly = status === 'in' && !needsOnboarding;
  useEffect(() => { if (status !== 'loading') SplashScreen.hideAsync().catch(() => {}); }, [status]);
  useEffect(() => { if (inAppEarly) registerPush().catch(() => {}); }, [inAppEarly]);
  if (status === 'loading') return <View style={{ flex: 1, backgroundColor: C.pine950 }} />;
  const inApp = status === 'in' && !needsOnboarding;
  return (
    <>
      <Stack screenOptions={{
        headerTintColor: C.pine900, headerStyle: { backgroundColor: C.paper }, headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' }, contentStyle: { backgroundColor: C.paper }, headerBackButtonDisplayMode: 'minimal',
      }}>
        <Stack.Protected guard={status === 'out'}>
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={status === 'in' && needsOnboarding}>
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        </Stack.Protected>
        <Stack.Protected guard={inApp}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: lang === 'hi' ? 'होम' : 'Home' }} />
          <Stack.Screen name="voice" options={{ presentation: 'fullScreenModal', headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="networth" options={{ title: lang === 'hi' ? 'नेट वर्थ' : 'Net worth' }} />
          <Stack.Screen name="invest" options={{ title: lang === 'hi' ? 'निवेश' : 'Invest' }} />
          <Stack.Screen name="insurance/index" options={{ title: lang === 'hi' ? 'बीमा' : 'Insurance' }} />
          <Stack.Screen name="insurance/market" options={{ title: lang === 'hi' ? 'प्लान खोजें' : 'Find & compare plans' }} />
          <Stack.Screen name="tax/index" options={{ title: lang === 'hi' ? 'टैक्स' : 'Tax' }} />
          <Stack.Screen name="tax/file" options={{ title: lang === 'hi' ? 'ITR ख़ुद भरें' : 'File your ITR' }} />
          <Stack.Screen name="actions" options={{ title: lang === 'hi' ? 'कदम' : 'Action plan' }} />
          <Stack.Screen name="markets" options={{ title: lang === 'hi' ? 'मार्केट और ख़बरें' : 'Markets & news' }} />
          <Stack.Screen name="records" options={{ title: lang === 'hi' ? 'मासिक रिकॉर्ड' : 'Monthly records' }} />
          <Stack.Screen name="statement" options={{ title: lang === 'hi' ? 'स्टेटमेंट स्कैन' : 'Statement scan' }} />
          <Stack.Screen name="vault" options={{ title: lang === 'hi' ? 'डॉक्यूमेंट वॉल्ट' : 'Document vault' }} />
          <Stack.Screen name="ca/index" options={{ title: lang === 'hi' ? 'आपका CA' : 'Your CA' }} />
          <Stack.Screen name="ca/[id]" options={{ title: 'CA' }} />
          <Stack.Screen name="reports" options={{ title: lang === 'hi' ? 'रिपोर्ट' : 'Reports' }} />
          <Stack.Screen name="plans" options={{ title: lang === 'hi' ? 'प्लान' : 'Plans' }} />
          <Stack.Screen name="settings" options={{ title: lang === 'hi' ? 'सेटिंग्स' : 'Settings' }} />
        </Stack.Protected>
        <Stack.Screen name="legal/[doc]" options={{ title: '' }} />
      </Stack>
      {inApp && <GuideCard bottomOffset={70} />}
      <BiometricLock enabled={inApp} />
    </>
  );
}

/** Optional app lock (Settings → Security). Locks on launch and after 60 s in the background. */
function BiometricLock({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(false);
  const [locked, setLocked] = useState(false);
  const bgAt = useRef<number>(0);
  useEffect(() => {
    SecureStore.getItemAsync(BIOLOCK_KEY).then((v) => { const e = v === '1'; setOn(e); if (e) setLocked(true); }).catch(() => {});
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') bgAt.current = Date.now();
      if (s === 'active' && bgAt.current && Date.now() - bgAt.current > 60_000) {
        SecureStore.getItemAsync(BIOLOCK_KEY).then((v) => { if (v === '1') { setOn(true); setLocked(true); } }).catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);
  const unlock = async () => {
    try {
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock PayWatch', fallbackLabel: 'Use passcode' });
      if (r.success) setLocked(false);
    } catch {}
  };
  useEffect(() => { if (locked && enabled) unlock(); }, [locked, enabled]);
  if (!enabled || !on || !locked) return null;
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.pine950, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
      <Orb size={110} />
      <H2 style={{ color: C.white }}>PayWatch is locked</H2>
      <Soft style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>Unlock to see your money.</Soft>
      <Button kind="mint" title={Platform.OS === 'ios' ? 'Unlock with Face ID' : 'Unlock'} icon="finger-print" onPress={unlock} />
    </View>
  );
}

export default function Root() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <AssistantProvider>
            <StatusBar style="dark" />
            <Gate />
          </AssistantProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
