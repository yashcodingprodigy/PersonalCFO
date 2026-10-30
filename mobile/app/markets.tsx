// Markets & news — headlines first (open on the publisher's site), then investment themes explained simply.
import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useApi } from '@/lib/hooks';
import { ago } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { C, SP } from '@/lib/theme';
import { Bullets, Card, Chip, Disclaimer, ErrorBox, Loading, Screen, Section, Small, Soft, Tiny, Txt, H3, Button } from '@/components/ui';

const RISK: Record<string, { bg: string; fg: string }> = { low: { bg: '#E2F3E5', fg: C.green }, medium: { bg: '#FBF0DF', fg: C.amber }, high: { bg: '#F8E3DF', fg: C.red } };

export default function Markets() {
  const { lang } = useLang();
  const { data: m, loading, error, reload, refreshing } = useApi<any>('/market');
  if (loading && !m) return <Screen><Loading /></Screen>;
  if (!m) return <Screen><ErrorBox message={error || 'Could not load'} onRetry={reload} /></Screen>;
  return (
    <Screen onRefresh={reload} refreshing={refreshing}>
      <Section title="Latest headlines" style={{ marginTop: 0 }}>
        <Card style={{ paddingVertical: 4 }}>
          {m.news?.length ? m.news.map((n: any, i: number) => (
            <View key={i} style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.paper100 }}>
              <Txt noTr style={{ fontSize: 15, lineHeight: 21, color: C.ink }} onPress={() => WebBrowser.openBrowserAsync(n.link).catch(() => {})} accessibilityRole="link">{n.title}</Txt>
              <Tiny noTr style={{ marginTop: 4 }}>{`${n.source || ''}${n.published ? ` · ${ago(n.published, lang)}` : ''}`}</Tiny>
            </View>
          )) : <Small style={{ paddingVertical: 12 }}>{m.newsError ? 'News couldn’t be loaded right now — try again shortly.' : 'No recent headlines.'}</Small>}
        </Card>
        <Tiny style={{ marginTop: 6 }}>Third-party headlines shown for awareness; they open on the publisher’s site.</Tiny>
      </Section>
      <Section title="Investment themes" sub="The building blocks, explained simply." right={<Button small kind="ghost" title="Fit to me →" onPress={() => router.push('/invest')} />}>
        <View style={{ gap: 10 }}>
          {(m.themes || []).map((t: any, i: number) => (
            <Card key={i} style={{ borderLeftWidth: 4, borderLeftColor: RISK[t.risk]?.fg || C.inkFaint }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><H3 style={{ flex: 1, fontSize: 15.5 }}>{t.theme}</H3><Chip label={`${t.risk} risk`} bg={RISK[t.risk]?.bg} color={RISK[t.risk]?.fg} /></View>
              <Small style={{ marginTop: 6 }}>{t.whatItIs}</Small>
              <Small style={{ marginTop: 6, color: C.pine800 }}>{`Who it suits: ${t.whoItSuits}`}</Small>
            </Card>
          ))}
        </View>
      </Section>
      {m.basics?.length > 0 && <Section title="Smart-investor basics"><Card><Bullets items={m.basics} /></Card></Section>}
      <Disclaimer>{m.disclaimer || 'Educational content, not investment advice.'}</Disclaimer>
    </Screen>
  );
}
