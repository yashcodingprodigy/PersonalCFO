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
import { Bullets, Card, Chip, Disclaimer, Disclosure, ErrorBox, Loading, Screen, Section, Small, Tiny, Txt, H2, H3, Button } from '@/components/ui';

const TONE: Record<string, string> = { rates: C.ocean, inflation: C.gold700, tax: C.violet, markets: C.pine700, insurance: C.berry, banking: C.teal, savings: C.pine700, gold: C.gold700, economy: C.inkSoft, scam: C.red, other: C.inkSoft };
const open = (url: string) => WebBrowser.openBrowserAsync(url).catch(() => {});
const go = (href: string) => { const r = nativeRoute(href); if (r.route) router.push(r.route as any); else if (r.web) open(r.web); };

export default function Markets() {
  const { lang } = useLang();
  const { data: m, loading, error, reload, refreshing } = useApi<any>(`/market?lang=${lang}`);
  const [filter, setFilter] = useState('foryou');
  const news: any[] = m?.news || [];
  const themes = useMemo(() => Array.from(new Set(news.map((n) => n.theme))), [news]);
  if (loading && !m) return <Screen><Loading label="Reading the official numbers…" /></Screen>;
  if (!m) return <Screen><ErrorBox message={error || 'Could not load'} onRetry={reload} /></Screen>;
  const impacts: any[] = m.impacts || [];
  const shown = news.filter((n) => filter === 'all' ? true : filter === 'foryou' ? n.forYou : n.theme === filter);
  const chips: [string, string][] = [['foryou', `For you (${news.filter((n) => n.forYou).length})`], ['all', `All (${news.length})`], ...themes.map((t) => [t, m.themeLabels[t]] as [string, string])];

  return (
    <Screen onRefresh={reload} refreshing={refreshing}>
      <Card tone="dark" style={{ backgroundColor: C.pine950 }}>
        <Tiny style={{ color: C.mint300, letterSpacing: 2, fontWeight: '700' }}>MARKETS, IN YOUR MONEY</Tiny>
        <H2 style={{ color: C.white, marginTop: 6 }}>{impacts.length ? `${impacts.length} change${impacts.length > 1 ? 's' : ''} in the money world touch your finances right now.` : 'Here’s what’s moving in the money world.'}</H2>
        <Small style={{ color: 'rgba(255,255,255,.7)', marginTop: 6 }}>We read the official numbers and money news, then work out what they mean for your loans, savings, spending and dreams.</Small>
      </Card>

      <Section title="What changed" sub="Official figures, with the change since last time.">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: SP.lg }}>
          {m.facts.map((f: any) => {
            const d = f.prev != null ? +(f.value - f.prev).toFixed(2) : null;
            return (
              <Card key={f.key} style={{ width: 220 }}>
                <Tiny style={{ fontWeight: '700', letterSpacing: 1 }}>{f.label.toUpperCase()}</Tiny>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 4 }}>
                  <Txt noTr style={{ fontSize: 28, fontWeight: '700', color: C.ink }}>{`${f.value}%`}</Txt>
                  {d ? <Txt noTr style={{ marginBottom: 4, fontWeight: '700', color: d > 0 ? C.red : C.green }}>{`${d > 0 ? '▲' : '▼'} ${Math.abs(d)}`}</Txt> : null}
                </View>
                <Tiny>{`${f.period ? f.period + ' · ' : ''}${f.prev != null ? `was ${f.prev}%` : ''}`}</Tiny>
                {f.note ? <Small style={{ marginTop: 6 }}>{f.note}</Small> : null}
                {f.next ? <Tiny style={{ marginTop: 6, color: C.pine700, fontWeight: '700' }}>{f.next}</Tiny> : null}
                <Tiny style={{ marginTop: 6, textDecorationLine: 'underline' }} onPress={() => open(f.sourceUrl)}>{`Source: ${f.source}`}</Tiny>
              </Card>
            );
          })}
        </ScrollView>
      </Section>

      <Section title="What it means for you" sub="Estimates from your own numbers.">
        {impacts.length === 0 ? <Card><Small>Add your loans, savings and spending in Settings and we’ll show how these changes touch your money.</Small></Card> : (
          <View style={{ gap: 10 }}>
            {impacts.map((i) => (
              <Card key={i.id} style={{ borderLeftWidth: 4, borderLeftColor: i.good === false ? C.amber : i.good === true ? C.green : C.paper200 }}>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  <Chip label={m.themeLabels[i.theme]} color={TONE[i.theme] || C.inkSoft} bg={C.paper100} />
                  {i.good === false && <Chip label="Costs you" color={C.amber} bg={C.gold100} />}
                  {i.good === true && <Chip label="Good for you" color={C.green} bg={C.mint100} />}
                </View>
                <H3 style={{ marginTop: 8, fontSize: 15.5 }}>{i.title}</H3>
                <Small style={{ marginTop: 4 }}>{i.detail}</Small>
                <Button small kind="ghost" title={`${i.cta} →`} onPress={() => go(i.href)} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
              </Card>
            ))}
          </View>
        )}
      </Section>

      <Section title="Money news" sub="From licensed or permitted sources. Tap to read at the source.">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
          {chips.map(([k, l]) => (
            <Pressable key={k} onPress={() => setFilter(k)} accessibilityRole="button" accessibilityState={{ selected: filter === k }}
              style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: filter === k ? C.pine900 : C.white, borderWidth: 1, borderColor: filter === k ? C.pine900 : C.paper200 }}>
              <Txt style={{ fontSize: 12.5, fontWeight: '700', color: filter === k ? C.white : C.inkSoft }}>{l}</Txt>
            </Pressable>
          ))}
        </ScrollView>
        <Card style={{ paddingVertical: 4 }}>
          {shown.length ? shown.map((n, idx) => (
            <View key={idx} style={{ paddingVertical: 12, borderTopWidth: idx ? 1 : 0, borderTopColor: C.paper100 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Chip label={n.themeLabel} color={TONE[n.theme] || C.inkSoft} bg={C.paper100} />
                {n.forYou && <Chip label="For you" color={C.white} bg={C.pine900} />}
              </View>
              <Txt noTr={n.lang === lang} style={{ fontSize: 15, lineHeight: 21, color: C.ink, fontWeight: '600', marginTop: 6 }} onPress={() => open(n.link)} accessibilityRole="link">{n.title}</Txt>
              <Small style={{ marginTop: 4, color: C.pine800 }}>{`Why it matters to you: ${n.whyItMatters}`}</Small>
              <Tiny noTr style={{ marginTop: 4 }}>{`Source: ${n.source}${n.published ? ` · ${ago(n.published, lang)}` : ''}`}</Tiny>
            </View>
          )) : <Small style={{ paddingVertical: 12 }}>{m.newsError ? 'News couldn’t be loaded right now — try again shortly.' : filter === 'foryou' ? 'Nothing in today’s news touches your money directly. Tap “All” to browse.' : 'No headlines here right now.'}</Small>}
        </Card>
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
