// Home — the money brain. Reads as a story: how your dreams are doing → your dreams →
// where money goes → what I did while you were away + next moves → future you.
import React, { useState } from 'react';
import { Pressable, ScrollView, TextInput, View, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useApi } from '@/lib/hooks';
import { patch } from '@/lib/api';
import { inr } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useAssistant } from '@/lib/assistant';
import { C, FONT, R, SP } from '@/lib/theme';
import { Card, H2, Icon, Label, Loading, Num, Orb, Section, Small, Soft, Stat, Tiny, Txt, ErrorBox, Disclaimer } from '@/components/ui';
import { AwayFeed, DreamCard, FutureYou, MoneyFlow, NextMoves, ScoreCard } from '@/components/brain';

export default function Home() {
  const { t, lang } = useLang();
  const { me } = useAuth();
  const { openChat, openVoice } = useAssistant();
  const brain = useApi<any>(`/brain?lang=${lang}`);
  const score = useApi<any>('/score');
  const networth = useApi<any>('/networth');
  const activity = useApi<any[]>(`/brain/activity?limit=8&lang=${lang}`);
  const aa = useApi<any>('/aa/status');
  const [afford, setAfford] = useState('');
  const refreshing = brain.refreshing || score.refreshing;
  const reload = () => { brain.reload(); score.reload(); networth.reload(); activity.reload(); };

  const b = brain.data;
  const items: any[] = b?.plan?.items || [];
  const dreams = items.filter((i) => !i.virtual);
  const onTrack = dreams.filter((d) => d.status === 'on_track' || d.status === 'achieved').length;
  const n = dreams.length;
  const headline = !n ? t('home.noDreams') : onTrack === n ? (n === 1 ? t('home.oneOk') : t('home.allOk', { n }))
    : onTrack === 0 ? (n === 1 ? t('home.oneHelp') : t('home.noneOk', { n })) : t('home.someOk', { k: onTrack, n });
  const first = (me?.name || '').split(' ')[0];

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={C.mint500} />}>
        {/* HERO */}
        <View style={{ backgroundColor: C.pine950, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden' }}>
          <SafeAreaView edges={['top']}>
            <View style={{ padding: SP.xl, paddingTop: SP.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Txt noTr style={{ color: C.mint300, fontSize: 11, fontWeight: '700', letterSpacing: 2.5 }}>{t('home.kicker').toUpperCase()}</Txt>
                <Pressable onPress={() => router.push('/settings')} hitSlop={10} accessibilityLabel="Settings"><Icon name="person-circle-outline" size={28} color="rgba(255,255,255,0.8)" /></Pressable>
              </View>
              <View style={{ alignItems: 'center', marginVertical: 6 }}>
                <Pressable onPress={openVoice} accessibilityRole="button" accessibilityLabel={t('home.tellDream')}><Orb size={130} /></Pressable>
              </View>
              <Txt noTr style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16 }}>{t('home.hi')}{first ? `, ${first}` : ''} 👋</Txt>
              <Txt noTr style={{ color: C.white, fontFamily: FONT.display, fontSize: 30, lineHeight: 36, marginTop: 4 }}>{headline}</Txt>
              <Txt noTr style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, lineHeight: 22, marginTop: 8 }}>{n ? t('home.working') : t('home.idle')}</Txt>
              <Pressable onPress={openVoice} accessibilityRole="button" style={{ marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.mint500, borderRadius: R.pill, paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'flex-start' }}>
                <Icon name="mic" size={20} color={C.pine950} /><Txt noTr style={{ fontWeight: '800', color: C.pine950 }}>{t('home.tellDream')}</Txt>
              </Pressable>
              <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: R.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', paddingLeft: 16, paddingRight: 4, minHeight: 48 }}>
                <Txt noTr style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginRight: 6 }}>{t('home.canIAfford')}</Txt>
                <TextInput value={afford} onChangeText={setAfford} placeholder={lang === 'hi' ? 'नया फ़ोन' : 'a new phone'} placeholderTextColor="rgba(255,255,255,0.35)"
                  style={{ flex: 1, color: C.white, fontSize: 15, paddingVertical: 8 }} returnKeyType="send"
                  onSubmitEditing={() => { if (afford.trim()) { openChat(`${lang === 'hi' ? 'क्या मैं ले सकता हूँ' : 'Can I afford'} ${afford.trim()}?`); setAfford(''); } }} />
                <Pressable onPress={() => { if (afford.trim()) { openChat(`${lang === 'hi' ? 'क्या मैं ले सकता हूँ' : 'Can I afford'} ${afford.trim()}?`); setAfford(''); } }}
                  style={{ backgroundColor: C.white, borderRadius: R.pill, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Ask"><Icon name="arrow-forward" color={C.pine950} /></Pressable>
              </View>
              {b?.plan?.hasData && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
                  <Stat dark label={t('home.guiltFree')} value={inr(b.plan.joyBudget)} sub={t('home.perMonth')} />
                  <Stat dark label={t('home.setAside')} value={inr(b.plan.earmarkedTotal || 0)} />
                  <Stat dark label={t('home.safety')} value={inr(b.map?.liquid || 0)} />
                </View>
              )}
            </View>
          </SafeAreaView>
        </View>

        <View style={{ paddingHorizontal: SP.lg }}>
          {brain.loading && !b ? <Loading /> : brain.error && !b ? <View style={{ marginTop: SP.lg }}><ErrorBox message={brain.error} onRetry={reload} /></View> : null}

          {/* DREAMS */}
          <Section title={t('home.yourDreams')} right={<Pressable onPress={() => router.navigate('/dreams')}><Txt noTr style={{ color: C.pine700, fontWeight: '700' }}>{t('common.seeAll')} →</Txt></Pressable>}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: SP.lg, paddingBottom: 6 }} style={{ marginHorizontal: -SP.lg, paddingLeft: SP.lg }}>
              {dreams.map((d) => <DreamCard key={d.id} d={d} onPress={() => openChat(lang === 'hi' ? `मेरा "${d.name}" सपना कैसे चल रहा है?` : `How is my "${d.name}" dream doing?`)} />)}
              <Card onPress={() => router.navigate({ pathname: '/dreams', params: { add: '1' } } as any)} tone="paper" style={{ width: 200, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: C.paper200, minHeight: 220 }}>
                <Orb size={46} />
                <Txt noTr style={{ fontFamily: FONT.display, fontSize: 18, marginTop: 8 }}>{t('home.addDream')}</Txt>
              </Card>
            </ScrollView>
          </Section>

          {b?.map?.hasData && <Section title={t('home.flow')}><MoneyFlow map={b.map} plan={b.plan} /></Section>}

          <Section title={t('home.moves')}><NextMoves brain={b} /></Section>

          <Section title={t('home.away')}><Card><AwayFeed items={Array.isArray(activity.data) ? activity.data : []} /></Card></Section>

          <Section title={t('home.future')}>
            <FutureYou networth={networth.data} onRisk={async (r) => { await patch('/user/me', { risk_appetite: r }); }} />
          </Section>

          <View style={{ marginTop: SP.lg, gap: 12 }}>
            {score.data && <Card onPress={() => router.push('/actions')}><ScoreCard score={score.data} /></Card>}
            {networth.data && (
              <Card onPress={() => router.push('/networth')}>
                <Label>{t('home.networth')}</Label>
                <Num style={{ fontFamily: FONT.display, fontSize: 30, marginTop: 4 }}>{inr(networth.data.netWorth || 0)}</Num>
                <Small noTr>{inr(networth.data.totalAssets)} − {inr(networth.data.totalLiabilities)}</Small>
              </Card>
            )}
            {!aa.data?.linked && (
              <Card onPress={() => router.push('/statement')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Icon name="document-text-outline" size={24} color={C.pine700} />
                <Txt style={{ flex: 1, fontWeight: '600' }}>Upload a bank statement — the brain re-plans automatically</Txt>
                <Icon name="chevron-forward" color={C.inkFaint} />
              </Card>
            )}
          </View>
          <Disclaimer>PayWatch provides financial education and organisation based on your data and published planning standards. It is not SEBI-registered investment advice. Plans, dates and projections are estimates, not guarantees.</Disclaimer>
        </View>
      </ScrollView>
    </View>
  );
}
