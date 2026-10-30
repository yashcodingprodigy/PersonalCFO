// Dreams — every dream gets a plan: what it needs a month, what the plan sets aside, when it's done,
// and if it doesn't fit, the levers that make it a yes. Plus "Can I afford it?".
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApi } from '@/lib/hooks';
import { ask, del, post, put } from '@/lib/api';
import { inr, prettyMonth, rupeesToPaise } from '@/lib/format';
import { useLang, TKey } from '@/lib/i18n';
import { C, FONT, R, SP, STATUS } from '@/lib/theme';
import { Button, Card, Chip, Disclaimer, Empty, H1, H3, Input, Label, Loading, MoneyInput, Num, Ring, Screen, Section, Segmented, Select, Sheet, Small, Soft, Stat, Tiny, Txt, Gap } from '@/components/ui';
import { PriceGuide } from '@/components/brain';

const PRIORITY = [{ v: 1, label: 'Must-have' }, { v: 2, label: 'Important' }, { v: 3, label: 'Nice to have' }];
const PICKS = [
  { key: 'trip', emoji: '✈️', label: 'A trip', goal_type: 'custom', kind: 'experience', name: 'Trip' },
  { key: 'gadget', emoji: '📱', label: 'A gadget', goal_type: 'custom', kind: 'purchase', name: 'New gadget' },
  { key: 'parents', emoji: '💚', label: 'Parents’ health cover', goal_type: 'custom', kind: 'family', name: 'Parents’ health cover' },
  { key: 'course', emoji: '🎓', label: 'A course', goal_type: 'custom', kind: 'purchase', name: 'Course' },
  { key: 'emergency', emoji: '🛟', label: 'Emergency fund', goal_type: 'emergency_fund', kind: 'safety', name: 'Emergency fund' },
  { key: 'vehicle', emoji: '🛵', label: 'A vehicle', goal_type: 'car_purchase', kind: 'purchase', name: 'Vehicle' },
  { key: 'home', emoji: '🏡', label: 'A home', goal_type: 'home_purchase', kind: 'purchase', name: 'Home down payment' },
  { key: 'wedding', emoji: '💍', label: 'A wedding', goal_type: 'custom', kind: 'family', name: 'Wedding' },
  { key: 'business', emoji: '☕', label: 'My own business', goal_type: 'custom', kind: 'milestone', name: 'My own business' },
  { key: 'other', emoji: '✨', label: 'Something else', goal_type: 'custom', kind: 'experience', name: '' },
];
const WHEN = [{ v: '', label: 'No fixed date' }, ...[3, 6, 12, 18, 24, 36, 60, 120].map((m) => ({ v: String(m), label: m < 12 ? `In ${m} months` : `In ${m / 12} year${m > 12 ? 's' : ''}` }))];
const monthsToDate = (m: string) => { if (!m) return null; const d = new Date(); d.setMonth(d.getMonth() + Number(m)); return d.toISOString().slice(0, 10); };

export default function Dreams() {
  const { lang, t } = useLang();
  const params = useLocalSearchParams<{ add?: string }>();
  const brain = useApi<any>(`/brain?lang=${lang}`);
  const goals = useApi<any[]>('/goals');
  const [form, setForm] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const [pick, setPick] = useState(PICKS[0]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [when, setWhen] = useState('');
  const [saved, setSaved] = useState('');
  const [prio, setPrio] = useState(2);
  const [busy, setBusy] = useState(false);

  const [aLabel, setALabel] = useState('');
  const [aAmount, setAAmount] = useState('');
  const [aMonths, setAMonths] = useState('');
  const [aRes, setARes] = useState<any>(null);
  const [aBusy, setABusy] = useState(false);

  useEffect(() => { if (params.add) setForm(true); }, [params.add]);

  async function addDream() {
    setBusy(true); setErr('');
    try {
      await post('/goals', {
        goal_type: pick.goal_type, name: (name || pick.name || 'My dream').slice(0, 100), target_amount: rupeesToPaise(amount),
        target_date: monthsToDate(when), current_amount: saved ? rupeesToPaise(saved) : 0, monthly_contribution: 0,
        meta: { kind: pick.kind, priority: pick.kind === 'safety' ? 1 : prio },
      });
      setForm(false); setName(''); setAmount(''); setWhen(''); setSaved(''); setPrio(2);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  const setPriority = (id: string, v: number) => put(`/goals/${id}`, { meta: { priority: v } }).catch((e) => setErr(e.message));
  const remove = (id: string) => Alert.alert('Remove this dream?', 'Your plan will be recalculated.', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => del(`/goals/${id}`).catch((e) => setErr(e.message)) },
  ]);
  async function afford() {
    setABusy(true); setARes(null);
    try { setARes(await ask('/brain/afford', { amount: rupeesToPaise(aAmount), months: aMonths ? Number(aMonths) : null, label: aLabel.trim() || undefined })); }
    catch (e: any) { setARes({ verdict: 'error', headline: e.message, levers: [] }); } finally { setABusy(false); }
  }

  const plan = brain.data?.plan, map = brain.data?.map;
  const byId = new Map((goals.data || []).map((g: any) => [String(g.goal_id), g]));
  const items: any[] = plan?.items || [];
  const real = items.filter((i) => !i.virtual);
  const safety = items.find((i) => i.id === 'virtual-safety');

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.paper }}>
      <Screen onRefresh={() => { brain.reload(); goals.reload(); }} refreshing={brain.refreshing} contentStyle={{ paddingBottom: 60 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <H1>{t('home.yourDreams')}</H1>
          <Button small title="+ Add" onPress={() => setForm(true)} />
        </View>
        <Soft style={{ marginTop: 4 }}>Tell me what you want — I’ll turn it into a plan and quietly handle the money behind it.</Soft>
        {err ? <Small style={{ color: C.red, marginTop: 8 }}>{err}</Small> : null}

        {brain.loading && !plan ? <Loading /> : plan && (
          <View style={{ marginTop: SP.lg, borderRadius: R.lg, padding: SP.lg, backgroundColor: C.pine900 }}>
            <Txt noTr style={{ color: C.white, fontFamily: FONT.display, fontSize: 18, lineHeight: 24 }}>{plan.summary}</Txt>
            {plan.hasData ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                <Stat dark style={{ minWidth: '45%' }} label="Free to plan" value={`${inr(plan.free)}/mo`} />
                <Stat dark style={{ minWidth: '45%' }} label="Guilt-free" value={`${inr(plan.joyBudget)}/mo`} />
                <Stat dark style={{ minWidth: '45%' }} label="Spare cash" value={inr(map?.excessCash || 0)} />
                <Stat dark style={{ minWidth: '45%' }} label="Safety net" value={map?.emergencyGap > 0 ? `${inr(map.emergencyGap)} to go` : 'Covered ✓'} />
              </View>
            ) : <Button kind="mint" small title="Add income & spending →" style={{ marginTop: 12, alignSelf: 'flex-start' }} onPress={() => router.push('/settings')} />}
          </View>
        )}

        {/* Can I afford it? */}
        <Section title="Can I afford it?">
          <Card>
            <Input label="What?" value={aLabel} onChangeText={setALabel} placeholder="a laptop, Goa trip…" />
            {aLabel.trim().length >= 3 && <PriceGuide text={aLabel} selected={aAmount} onPick={setAAmount} />}
            <MoneyInput label="Cost" value={aAmount} onChange={setAAmount} placeholder="80,000" />
            <Select label="When?" value={aMonths} onChange={setAMonths} options={[{ v: '', label: 'Earliest possible' }, ...[1, 3, 6, 12, 24, 36, 60].map((m) => ({ v: String(m), label: m < 12 ? `In ${m} month${m > 1 ? 's' : ''}` : `In ${m / 12} year${m > 12 ? 's' : ''}` }))]} />
            <Button title="Check" onPress={afford} loading={aBusy} disabled={!aAmount} />
            {aRes && (
              <View style={{ marginTop: SP.md, borderRadius: R.md, padding: 12, borderWidth: 1,
                backgroundColor: aRes.verdict?.startsWith('yes') ? C.mint100 : aRes.verdict === 'stretch' ? '#FBF0DF' : C.paper50,
                borderColor: aRes.verdict?.startsWith('yes') ? C.mint500 + '66' : C.paper200 }}>
                <Txt noTr style={{ fontWeight: '700' }}>{aRes.headline}</Txt>
                {(aRes.levers || []).slice(0, 4).map((l: any, i: number) => <Small noTr key={i} style={{ marginTop: 4 }}>→ {l.label}</Small>)}
                {aRes.verdict !== 'error' && aRes.verdict !== 'need_data' && (
                  <Pressable onPress={() => { setPick(PICKS[PICKS.length - 1]); setName(aLabel); setAmount(aAmount); setForm(true); }} style={{ marginTop: 8 }}>
                    <Txt style={{ color: C.pine700, fontWeight: '700', fontSize: 14 }}>Turn this into a dream →</Txt>
                  </Pressable>
                )}
              </View>
            )}
            <Tiny style={{ marginTop: 10 }}>Planning estimate from your own numbers with conservative growth assumptions — not investment advice or a promise of returns.</Tiny>
          </Card>
        </Section>

        <Section title="Your plan, dream by dream">
          {plan && real.length === 0 && <Empty title="What do you want this year?" body="A trip, a gadget, your parents’ health cover, your own café one day…" action={<Button small title="+ Add your first dream" onPress={() => setForm(true)} />} />}
          <View style={{ gap: 12 }}>
            {[...(safety ? [safety] : []), ...real].map((it) => {
              const g: any = byId.get(String(it.id));
              const cur = g ? Number(g.current_amount) : it.saved || 0;
              const progress = it.adjustedTarget > 0 ? Math.min(1, cur / it.adjustedTarget) : 0;
              const st = STATUS[it.status] || STATUS.on_track;
              const isOpen = open === it.id;
              return (
                <Card key={it.id} style={it.virtual ? { borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.paper200 } : undefined}>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <H3 noTr numberOfLines={2}>{it.name}</H3>
                      <Tiny>{it.virtual ? 'Suggested by PayWatch' : `${it.kind} · ${PRIORITY.find((p) => p.v === it.priority)?.label || ''}`}</Tiny>
                    </View>
                    <Chip noTr label={t(`st.${it.status}` as TKey)} bg={st.bg} color={st.fg} />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12 }}>
                    <Ring value={it.virtual ? 0 : progress} size={70} stroke={7} color={st.color}><Num style={{ fontWeight: '700' }}>{it.virtual ? '🛟' : `${Math.round(progress * 100)}%`}</Num></Ring>
                    <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 }}>
                      {[['Target', inr(it.adjustedTarget)], ['Done by', it.status === 'achieved' ? 'Now' : prettyMonth(it.projectedDate, lang)], ['Needs', `${inr(it.need)}/mo`], ['Plan sets aside', `${inr(it.allocated)}/mo`]].map(([k, v], i) => (
                        <View key={k} style={{ width: '50%' }}>
                          <Tiny>{k}</Tiny>
                          <Num style={{ fontWeight: '700', fontSize: 14, color: i === 3 && it.allocated < it.need ? C.amber : C.ink }} numberOfLines={1} adjustsFontSizeToFit>{v}</Num>
                        </View>
                      ))}
                    </View>
                  </View>
                  {it.levers?.length > 0 && (
                    <View style={{ marginTop: 10 }}>
                      <Pressable onPress={() => setOpen(isOpen ? null : it.id)} accessibilityRole="button"><Txt style={{ color: C.pine700, fontWeight: '700', fontSize: 14 }}>{isOpen ? 'Hide options ▴' : 'Make it a yes ▾'}</Txt></Pressable>
                      {isOpen && it.levers.map((l: any, i: number) => <Small noTr key={i} style={{ marginTop: 6 }}>→ {l.label}</Small>)}
                    </View>
                  )}
                  {!it.virtual && g && (
                    <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.paper100, gap: 8 }}>
                      <Segmented value={it.priority} onChange={(v: number) => setPriority(String(it.id), v)} options={PRIORITY} />
                      <Pressable onPress={() => remove(String(it.id))} style={{ alignSelf: 'flex-end' }} hitSlop={8}><Small style={{ textDecorationLine: 'underline' }}>Remove</Small></Pressable>
                    </View>
                  )}
                  {it.virtual && (
                    <Pressable onPress={() => { setPick(PICKS[4]); setName('Emergency fund'); setAmount(String(Math.round(it.adjustedTarget / 100))); setForm(true); }} style={{ marginTop: 10 }}>
                      <Small>A safety net keeps a surprise bill from eating your dreams. <Txt style={{ color: C.pine700, fontWeight: '700', fontSize: 13 }}>Make it yours →</Txt></Small>
                    </Pressable>
                  )}
                </Card>
              );
            })}
          </View>
        </Section>
        <Disclaimer>Plans use your take-home, spending and existing SIPs, with conservative growth assumptions by time horizon. Educational planning — not investment advice.</Disclaimer>
      </Screen>

      <Sheet visible={form} onClose={() => setForm(false)} title="Add a dream" full>
        <Label>What’s the dream?</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: SP.lg }}>
          {PICKS.map((p) => (
            <Pressable key={p.key} onPress={() => { setPick(p); setName(p.name); }} accessibilityRole="radio" accessibilityState={{ selected: pick.key === p.key }}
              style={{ borderRadius: R.pill, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderColor: pick.key === p.key ? C.pine900 : C.paper200, backgroundColor: pick.key === p.key ? C.pine900 : C.white }}>
              <Txt style={{ fontSize: 14, color: pick.key === p.key ? C.white : C.ink }}>{`${p.emoji} ${p.label}`}</Txt>
            </Pressable>
          ))}
        </View>
        <Input label="Name it" value={name} onChangeText={setName} placeholder="e.g. 2BHK in Pune, Bali with friends" />
        <PriceGuide text={name} selected={amount} onPick={setAmount} />
        <MoneyInput label="How much will it cost?" value={amount} onChange={setAmount} placeholder="60,000" />
        <Select label="By when?" value={when} onChange={setWhen} options={WHEN} />
        <MoneyInput label="Already saved for it" value={saved} onChange={setSaved} />
        {pick.kind !== 'safety' && <>
          <Label>How important is it?</Label>
          <Segmented style={{ marginTop: 8, marginBottom: SP.lg }} value={prio} onChange={setPrio} options={PRIORITY} />
        </>}
        <Button title="Make it a plan" onPress={addDream} loading={busy} disabled={!amount} />
        <Gap h={30} />
      </Sheet>
    </SafeAreaView>
  );
}
