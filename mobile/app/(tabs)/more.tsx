// More — every other part of PayWatch, grouped the way people think about money.
import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { C, SP } from '@/lib/theme';
import { Card, H1, Label, Row, Screen, Small, Gap, IconName } from '@/components/ui';

const GROUPS: { title: string; items: { icon: IconName; title: string; sub: string; to: string; color: string }[] }[] = [
  { title: 'Grow', items: [
    { icon: 'pie-chart-outline', title: 'Net worth', sub: 'What you own, what you owe, and where it’s heading', to: '/networth', color: C.pine700 },
    { icon: 'trending-up-outline', title: 'Invest', sub: 'Your mix, fund categories and a portfolio X-ray', to: '/invest', color: C.green },
    { icon: 'checkmark-done-outline', title: 'Action plan', sub: 'Every step, ranked by impact', to: '/actions', color: C.violet },
    { icon: 'newspaper-outline', title: 'Markets & news', sub: 'What’s happening, explained simply', to: '/markets', color: C.ocean },
  ] },
  { title: 'Protect', items: [
    { icon: 'shield-checkmark-outline', title: 'Insurance', sub: 'Your cover, your policies, what to get', to: '/insurance', color: C.teal },
    { icon: 'storefront-outline', title: 'Find & compare plans', sub: 'Options matched to your details', to: '/insurance/market', color: C.berry },
  ] },
  { title: 'Tax & documents', items: [
    { icon: 'calculator-outline', title: 'Tax', sub: 'Both regimes, full computation, ways to save', to: '/tax', color: C.amber },
    { icon: 'document-attach-outline', title: 'File your ITR', sub: 'Step-by-step self-filing guide', to: '/tax/file', color: C.coral },
    { icon: 'calendar-outline', title: 'Monthly records', sub: 'Payslips, Form 16, statements, proofs', to: '/records', color: C.ocean },
    { icon: 'scan-outline', title: 'Statement scan', sub: 'See where your money really went', to: '/statement', color: C.violet },
    { icon: 'lock-closed-outline', title: 'Document vault', sub: 'Encrypted copies of what matters', to: '/vault', color: C.pine700 },
    { icon: 'people-outline', title: 'Your CA', sub: 'Share documents and chat with your own CA', to: '/ca', color: C.teal },
  ] },
  { title: 'Account', items: [
    { icon: 'bar-chart-outline', title: 'Reports', sub: 'Your monthly money report', to: '/reports', color: C.ocean },
    { icon: 'star-outline', title: 'Plans', sub: 'What each plan includes', to: '/plans', color: C.gold },
    { icon: 'settings-outline', title: 'Settings', sub: 'Profile, language, security, your data', to: '/settings', color: C.inkSoft },
  ] },
];

export default function More() {
  const { me } = useAuth();
  const { t } = useLang();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.paper }}>
      <Screen contentStyle={{ paddingBottom: 60 }}>
        <H1>{t('tab.more')}</H1>
        {me?.name ? <Small noTr style={{ marginTop: 4 }}>{me.name}{me.email ? ` · ${me.email}` : ''}</Small> : null}
        {GROUPS.map((g) => (
          <View key={g.title} style={{ marginTop: SP.xl }}>
            <Label style={{ marginBottom: 8 }}>{g.title}</Label>
            <Card style={{ paddingVertical: 4 }}>
              {g.items.map((it, i) => <Row key={it.to} icon={it.icon} color={it.color} title={it.title} subtitle={it.sub} onPress={() => router.push(it.to as any)} last={i === g.items.length - 1} />)}
            </Card>
          </View>
        ))}
        <Gap h={SP.lg} />
        <Card style={{ paddingVertical: 4 }}>
          <Row icon="document-text-outline" title="Terms" onPress={() => router.push('/legal/terms')} />
          <Row icon="shield-outline" title="Privacy" onPress={() => router.push('/legal/privacy')} />
          <Row icon="information-circle-outline" title="Disclosures" onPress={() => router.push('/legal/disclosures')} last />
        </Card>
      </Screen>
    </SafeAreaView>
  );
}
