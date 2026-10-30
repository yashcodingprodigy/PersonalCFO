// Bottom tabs: Home · Dreams · Ask (the orb) · Alerts · More. Native tab bar on both platforms.
import React from 'react';
import { Platform, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '@/lib/theme';
import { useLang } from '@/lib/i18n';
import { useApi } from '@/lib/hooks';
import { Orb } from '@/components/ui';

export default function TabsLayout() {
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const { data: count } = useApi<{ unread: number }>('/alerts/count');
  const unread = count?.unread || 0;
  const icon = (name: keyof typeof Ionicons.glyphMap, active: keyof typeof Ionicons.glyphMap) =>
    ({ color, focused }: { color: any; focused: boolean }) => <Ionicons name={focused ? active : name} size={24} color={color} />;
  return (
    <View style={{ flex: 1 }}>
      <Tabs screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.pine900, tabBarInactiveTintColor: C.inkFaint,
        tabBarStyle: { backgroundColor: C.white, borderTopColor: C.paper200, height: 58 + insets.bottom, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 8) },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: C.paper },
      }}>
        <Tabs.Screen name="index" options={{ title: t('tab.home'), tabBarIcon: icon('home-outline', 'home') }} />
        <Tabs.Screen name="dreams" options={{ title: t('tab.dreams'), tabBarIcon: icon('sparkles-outline', 'sparkles') }} />
        <Tabs.Screen name="ask" options={{
          title: t('tab.ask'),
          tabBarIcon: ({ focused }) => <View style={{ marginTop: Platform.OS === 'ios' ? -2 : 0, opacity: focused ? 1 : 0.9 }}><Orb size={26} /></View>,
        }} />
        <Tabs.Screen name="alerts" options={{
          title: t('tab.alerts'), tabBarIcon: icon('notifications-outline', 'notifications'),
          tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined, tabBarBadgeStyle: { backgroundColor: C.red, fontSize: 10 },
        }} />
        <Tabs.Screen name="more" options={{ title: t('tab.more'), tabBarIcon: icon('grid-outline', 'grid') }} />
      </Tabs>
    </View>
  );
}
