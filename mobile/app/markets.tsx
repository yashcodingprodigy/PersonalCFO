// Markets — what changed (official rates & inflation), what it means for YOUR money (rupee impacts),
// and money news from licensed / permitted sources with a personal "why it matters". Education only.
import React, { useMemo, useState } from 'react';
import { ScrollView, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useApi } from '@/lib/hooks';
import { ago } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { nativeRoute } from '@/lib/routes';
import { C, SP } from '@/lib/theme';
import { FlipDeck } from '@/components/FlipDeck';
import { Bullets, Card, Chip, Disclaimer, Disclosure, ErrorBox, Loading, Screen, Section, Small, Tiny, Txt, H2, H3, Button } from '@/components/ui';

const TONE: Record<string, string> = { rates: C.ocean, inflation: C.gold700, tax: C.violet, markets: C.pine700, insurance: C.berry, banking: C.teal, savings: C.pine700, gold: C.gold700, economy: C.inkSoft, scam: C.red, other: C.inkSoft };
const open = (url: string) => WebBrowser.openBrowserAsync(url).catch(() => {});
const go = (href: string) => { const r = nativeRoute(href); if (r.route) router.push(r.route as any); else if (r.web) open(r.web); };

export default function Markets() {
  const { lang } = useLang();
  const { data: m, loading, error, reload, refreshing } = useApi<any>(`/market?lang=${lang}`);
  const [filter, setFilter] = useState('foryou');
  const deck: any[] = useMemo(() => (m?.deck || []).map((c: any) => ({ ...c, kicker: c.published ? `${c.kicker} · ${ago(c.published, lang)}` : c.kicker })), [m, lang]);
  const themes = useMemo(() => Array.from(new Set(deck.map((c) => c.theme))), [deck]);
  if (loading && !m) return <Screen><Loading label="Reading the official numbers…" /></Screen>;
  if (!m) return <Screen><ErrorBox message={error || 'Could not load'} onRetry={reload} /></Screen>;
  const impacts: any[] = m.impacts || [];
  const picked = deck.filter((c) => filter === 'all' ? true : filter === 'foryou' ? c.forYou : c.theme === filter);
  const shown = filter === 'foryou' && !picked.length ? deck : picked;
  const chips: [string, string][] = [['foryou', `For you (${deck.filter((c) => c.forYou).length})`], ['all', `All (${deck.length})`], ...themes.map((t) => [t, m.themeLabels[t]] as [string, string])];

  return (
    <Screen onRefresh={reload} refreshing={refreshing}>
      <Card tone="dark" style={{ backgroundColor: C.pine950 }}>
        <Tiny style={{ color: C.mint300, letterSpacing: 2, fontWeight: '700' }}>MARKETS, IN YOUR MONEY</Tiny>
        <H2 style={{ color: C.white, marginTop: 6 }}>{impacts.length ? `${impacts.length} change${impacts.length > 1 ? 's' : ''} in the money world touch your finances right now.` : 'Here’s what’s moving in the money world.'}</H2>
        <Small style={{ color: 'rgba(255,255,255,.7)', marginTop: 6 }}>We read the official numbers and money news, then work out what they mean for your loans, savings, spending and dreams.</Small>
      </Card>

      <Section title="This week in your money" sub="Each card is one piece of news. Tap it to flip and see what it means for you.">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
          {chips.map(([k, l]) => (
            <Pressable key={k} onPress={() => setFilter(k)} accessibilityRole="button" accessibilityState={{ selected: filter === k }}
              style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: filter === k ? C.pine900 : C.white, borderWidth: 1, borderColor: filter === k ? C.pine900 : C.paper200 }}>
              <Txt style={{ fontSize: 12.5, fontWeight: '700', color: filter === k ? C.white : C.inkSoft }}>{l}</Txt>
            </Pressable>
          ))}
        </ScrollView>
        {shown.length ? <FlipDeck key={filter} cards={shown} onGo={go} onOpen={open} />
          : <Card><Small>{m.newsError ? 'News couldn’t be loaded right now — try again shortly.' : 'No cards here right now.'}</Small></Card>}
        <Tiny style={{ marginTop: 8 }}>Rupee effects are estimates from the details you gave us. Headlines link to their original publisher.</Tiny>
      </Section>

      <Section title="Understand the building blocks">
        <View style={{ gap: 10 }}>
          <Disclosure title="Investment types, explained simply" subtitle="Categories only — never specific products">
            <View style={{ gap: 10 }}>
              {(m.themes || []).map((t: any, i: number) => (
                <View key={i}><H3 style={{ fontSize: 15 }}>{`${t.theme} · ${t.risk} risk`}</H3><Small style={{ marginTop: 4 }}>{t.whatItIs}</Small><Small style={{ marginTop: 4, color: C.pine800 }}>{`Who it suits: ${t.whoItSuits}`}</Small></View>
              ))}
            </View>
          </Disclosure>
          {m.basics?.length > 0 && <Disclosure title="Smart-money basics"><Bullets items={m.basics} /></Disclosure>}
        </View>
      </Section>

      <Card tone="paper" style={{ marginTop: SP.lg }}>
        <Tiny style={{ fontWeight: '700', letterSpacing: 1 }}>SOURCES & PERMISSIONS</Tiny>
        {m.sources.filter((s: any) => s.enabled).map((s: any) => <Small key={s.id} style={{ marginTop: 6 }}>{`${s.name} — ${s.license}`}</Small>)}
        <Small style={{ marginTop: 6 }}>RBI and MoSPI figures — official public data, cited on each card.</Small>
      </Card>
      <Disclaimer>{m.disclaimer}</Disclaimer>
    </Screen>
  );
}
