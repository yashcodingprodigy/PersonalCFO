// Find & compare insurance — browse categories → plans ranked by fit to YOUR inputs → configure →
// review → submit an application to our IRDAI-licensed partner. Premiums are indicative; nothing is charged here.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { get, post } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { inr, rupeesToPaise, prettyDate } from '@/lib/format';
import { C, FONT, R, SP } from '@/lib/theme';
import { Bullets, Button, Card, Check, Chip, Disclaimer, Input, Label, Loading, MoneyInput, Num, Orb, Screen, Sheet, Small, Soft, Tiny, Txt, H2, H3, Icon, Gap } from '@/components/ui';
import { PALETTE } from '@/components/charts';

const ICON: Record<string, any> = { term_life: 'shield-checkmark', health: 'medkit', personal_accident: 'body', critical_illness: 'heart', motor: 'car-sport', home: 'home', travel: 'airplane' };
const GST = 0.18;
const IDV = [
  { id: 'min', label: 'Minimum IDV', f: 0.9, desc: 'Lowest premium; lower payout on total loss or theft.' },
  { id: 'standard', label: 'Standard IDV', f: 1.0, desc: 'Balance between payout and premium.' },
  { id: 'max', label: 'Maximum IDV', f: 1.12, desc: 'Highest payout on total loss/theft. Good for newer vehicles.' },
];
function mono(name = '') {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'IN';
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { initials, color: PALETTE[h % (PALETTE.length - 1)] };
}

export default function Market() {
  const params = useLocalSearchParams<{ category?: string }>();
  const cats = useApi<any>('/insurance/market/categories');
  const [cat, setCat] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [cover, setCover] = useState('');
  const [age, setAge] = useState('');
  const [family, setFamily] = useState('');
  const [smoker, setSmoker] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [buy, setBuy] = useState<any>(null);

  useEffect(() => { if (params.category && cats.data && !cat) openCat(params.category); }, [params.category, cats.data]);

  function openCat(c: string) {
    setCat(c); setCompare([]); setData(null);
    const meta = (cats.data?.categories || []).find((x: any) => x.category === c);
    load(c, meta?.recommendedCover);
  }
  async function load(c: string, coverPaise?: number) {
    setLoading(true);
    const q = new URLSearchParams({ category: c });
    if (coverPaise) q.set('cover', String(coverPaise));
    if (age) q.set('age', age); if (family) q.set('family', family); if (smoker) q.set('smoker', '1');
    const d = await get(`/insurance/market/plans?${q.toString()}`).catch(() => null);
    if (d) { setData(d); setCover(String(Math.round(d.cover / 100))); setAge(String(d.ctx?.age ?? '')); setFamily(String(d.ctx?.familySize ?? '')); }
    setLoading(false);
  }

  if (!cat) return (
    <Screen onRefresh={cats.reload} refreshing={cats.refreshing}>
      <Soft>Compare real plans from leading insurers and start your application. Plans are arranged through our IRDAI-licensed insurance partner, who handles the quote, KYC, payment and issuance.</Soft>
      {cats.loading && !cats.data ? <Loading /> : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: SP.lg }}>
          {(cats.data?.categories || []).map((c: any) => (
            <Card key={c.category} onPress={() => openCat(c.category)} style={{ width: '48%', minHeight: 130 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.mint100, alignItems: 'center', justifyContent: 'center' }}><Icon name={ICON[c.category] || 'document'} color={C.pine700} /></View>
                <Tiny noTr>{`${c.planCount} plans`}</Tiny>
              </View>
              <Txt style={{ fontWeight: '700', marginTop: 8 }}>{c.label}</Txt>
              {c.recommendedCover != null && <Tiny noTr>{`suggested ${inr(c.recommendedCover)}`}</Tiny>}
              {c.gap > 0 && <Tiny noTr style={{ color: C.red, fontWeight: '700' }}>{`gap ${inr(c.gap)}`}</Tiny>}
            </Card>
          ))}
        </View>
      )}
      {cats.data?.verifyNote ? <Disclaimer>{cats.data.verifyNote}</Disclaimer> : null}
    </Screen>
  );

  const plans: any[] = data?.plans || [];
  const coverages: string[] = data?.coverages || [];
  const cheapest = plans.length ? Math.min(...plans.map((p) => p.indicativePremium || Infinity)) : 0;
  const per = cat === 'travel' ? 'trip' : 'yr';
  const compared = plans.filter((p) => compare.includes(p.id));
  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Pressable onPress={() => { setCat(''); setData(null); router.setParams({ category: '' } as any); }} hitSlop={8}><Txt style={{ color: C.pine700, fontWeight: '700' }}>‹ All insurance types</Txt></Pressable>
        <H2 style={{ marginTop: 8 }}>{data?.label || ''}</H2>
        <Small style={{ marginTop: 4 }}>Sorted by how well each matches the details you entered. Premiums are indicative — the insurer confirms the final premium.</Small>
        <Card tone="paper" style={{ marginTop: SP.md }}><Tiny>These are options for the details you provided, arranged through our IRDAI-licensed insurance partner and subject to insurer terms, underwriting and disclosures. Information to help you choose — not insurance advice.</Tiny></Card>
        <Card style={{ marginTop: SP.md }}>
          {cat !== 'travel' && <MoneyInput label={cat === 'motor' ? 'Vehicle value (IDV)' : 'Cover you want'} value={cover} onChange={setCover} />}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Input label="Age" value={age} onChangeText={(s) => setAge(s.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" /></View>
            {cat === 'health' && <View style={{ flex: 1 }}><Input label="Family size" value={family} onChangeText={(s) => setFamily(s.replace(/\D/g, '').slice(0, 1))} keyboardType="number-pad" /></View>}
          </View>
          {cat === 'term_life' && <Check checked={smoker} onChange={setSmoker}><Txt>Smoker</Txt></Check>}
          <Button small title="Update" onPress={() => load(cat, rupeesToPaise(cover) || undefined)} />
        </Card>
        <View style={{ gap: 12, marginTop: SP.lg }}>
          {loading ? <Loading label="Finding plans for your details…" /> : plans.map((p) => (
            <PlanCard key={p.id} p={p} coverages={coverages} per={per} cheapest={p.indicativePremium === cheapest}
              inCompare={compare.includes(p.id)} onCompare={() => setCompare((c) => c.includes(p.id) ? c.filter((x) => x !== p.id) : c.length >= 3 ? c : [...c, p.id])}
              onSelect={() => setBuy(p)} />
          ))}
        </View>
        {cats.data?.verifyNote ? <Disclaimer>{cats.data.verifyNote}</Disclaimer> : null}
        <Gap h={compared.length >= 2 ? 120 : 0} />
      </Screen>

      {compared.length >= 2 && (
        <View style={{ position: 'absolute', left: 12, right: 12, bottom: 24 }}>
          <Card style={{ elevation: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt style={{ fontWeight: '700' }}>{`Comparing ${compared.length}`}</Txt><Pressable onPress={() => setCompare([])}><Small style={{ textDecorationLine: 'underline' }}>Clear</Small></Pressable></View>
            {compared.map((p) => (
              <Pressable key={p.id} onPress={() => setBuy(p)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.paper100, gap: 8 }}>
                <View style={{ flex: 1 }}><Txt noTr style={{ fontWeight: '700', fontSize: 14 }} numberOfLines={1}>{p.insurer}</Txt><Tiny noTr numberOfLines={1}>{p.plan}</Tiny></View>
                <Num style={{ fontSize: 13 }}>{`${inr(p.indicativePremium)}/${per}`}</Num>
                <Num style={{ fontSize: 13, width: 46, textAlign: 'right' }}>{p.claimRatioPct ? `${p.claimRatioPct}%` : '—'}</Num>
              </Pressable>
            ))}
          </Card>
        </View>
      )}
      <Checkout plan={buy} category={cat} cover={data?.cover || 0} addOns={data?.addOns || []} onClose={() => setBuy(null)} />
    </View>
  );
}

function PlanCard({ p, coverages, per, cheapest, inCompare, onCompare, onSelect }: any) {
  const [open, setOpen] = useState(false);
  const m = mono(p.insurer);
  return (
    <Card style={[{ padding: 0, overflow: 'hidden' }, p.bestFit && { borderWidth: 2, borderColor: C.mint500 }]}>
      {p.bestFit && <View style={{ backgroundColor: C.mint500, paddingHorizontal: 14, paddingVertical: 6 }}><Txt style={{ fontSize: 11, fontWeight: '800', color: C.pine950, letterSpacing: 1 }}>★ MATCHES YOUR INPUTS</Txt></View>}
      <View style={{ padding: SP.lg }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <View style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: m.color, alignItems: 'center', justifyContent: 'center' }}><Txt noTr style={{ color: C.white, fontWeight: '800' }}>{m.initials}</Txt></View>
          <View style={{ flex: 1 }}><Tiny noTr>{p.insurer}</Tiny><Txt noTr style={{ fontWeight: '700' }}>{p.plan}</Txt></View>
        </View>
        {cheapest && <Chip label="💰 Lowest indicative premium here" style={{ marginTop: 10 }} />}
        {p.claimRatioPct ? <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}><Small>Claim settlement</Small><Num style={{ fontWeight: '700' }}>{`${p.claimRatioPct}%`}</Num></View> : null}
        {(p.reasons || []).slice(0, 2).map((r: string, i: number) => <Small key={i} style={{ color: C.pine800, marginTop: 4 }}>{`✓ ${r}`}</Small>)}
        <Pressable onPress={() => setOpen(!open)} style={{ marginTop: 8 }}><Txt style={{ color: C.ocean, fontWeight: '700', fontSize: 14 }}>{open ? 'Hide benefits' : 'View benefits'}</Txt></Pressable>
        {open && <View style={{ marginTop: 8, backgroundColor: C.paper50, borderRadius: R.md, padding: 12 }}>
          <Label>What’s covered</Label><View style={{ marginTop: 6 }}><Bullets items={coverages} mark="✓" /></View>
          {p.highlights?.length > 0 && <><Label style={{ marginTop: 10 }}>Plan highlights</Label><View style={{ marginTop: 6 }}><Bullets items={p.highlights} /></View></>}
        </View>}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.paper100, gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Tiny>PREMIUM (INDICATIVE)</Tiny>
            <Num style={{ fontFamily: FONT.display, fontSize: 22 }}>{inr(p.indicativePremium)}<Txt noTr style={{ fontSize: 12, color: C.inkFaint }}>{`/${per}`}</Txt></Num>
          </View>
          <Pressable onPress={onCompare} accessibilityRole="checkbox" accessibilityState={{ checked: inCompare }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 }}>
            <Icon name={inCompare ? 'checkbox' : 'square-outline'} size={20} color={C.pine700} /><Small>Compare</Small>
          </Pressable>
          <Button small title="Select" onPress={onSelect} />
        </View>
      </View>
    </Card>
  );
}

function Checkout({ plan, category, cover, addOns, onClose }: any) {
  const { me } = useAuth();
  const [phase, setPhase] = useState<'configure' | 'calculating' | 'review' | 'done'>('configure');
  const [idv, setIdv] = useState('min');
  const [sel, setSel] = useState<string[]>([]);
  const [form, setForm] = useState({ name: '', dob: '', mobile: '', email: '' });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (plan) { setPhase('configure'); setIdv('min'); setSel(addOns.filter((a: any) => a.popular).map((a: any) => a.id)); setConsent(false); setErr('');
      setForm({ name: me?.name || '', dob: '', mobile: me?.mobile || '', email: me?.email || '' }); }
  }, [plan]);
  const f = category === 'motor' ? (IDV.find((t) => t.id === idv)?.f || 1) : 1;
  const base = Math.round((plan?.indicativePremium || 0) * f);
  const idvValue = Math.round(cover * f);
  const addTotal = useMemo(() => addOns.filter((a: any) => sel.includes(a.id)).reduce((s: number, a: any) => s + a.price * 100, 0), [sel, addOns]);
  const net = base + addTotal, gst = Math.round(net * GST), total = net + gst;
  const per = category === 'travel' ? 'trip' : 'yr';

  async function submit() {
    setBusy(true); setErr('');
    try {
      await post('/insurance/applications', {
        plan_id: plan.id, category, insurer: plan.insurer, plan_name: plan.plan, cover: category === 'motor' ? idvValue : cover, premium_indicative: total,
        applicant: { ...form, notes: `IDV:${idv}; add-ons:${sel.join(',') || 'none'}; net:${inr(net)}; gst:${inr(gst)}; total:${inr(total)}`.slice(0, 400) },
      });
      setPhase('done');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <Sheet visible={!!plan} onClose={onClose} title={plan ? `${plan.insurer} · ${plan.plan}` : ''} full>
      {plan && phase === 'calculating' && <View style={{ alignItems: 'center', paddingVertical: 50, gap: 12 }}><Orb size={90} mode="thinking" /><Soft>Calculating your final premium…</Soft></View>}
      {plan && phase === 'done' && (
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 20 }}>
          <Txt noTr style={{ fontSize: 44 }}>🎉</Txt>
          <H3>Application started</H3>
          <Soft style={{ textAlign: 'center' }}>We’ll arrange it through our IRDAI-licensed insurer partner, who confirms the exact premium and completes KYC.</Soft>
          <Card tone="mint"><Small>Issuance & payment are activating soon — no premium has been collected. Track it under Insurance → My policies.</Small></Card>
          <Button title="Done" onPress={onClose} style={{ alignSelf: 'stretch' }} />
        </View>
      )}
      {plan && phase === 'configure' && <>
        {category === 'motor' && <>
          <Label style={{ marginBottom: 8 }}>Insured value (IDV)</Label>
          {IDV.map((t) => (
            <Pressable key={t.id} onPress={() => setIdv(t.id)} accessibilityRole="radio" accessibilityState={{ selected: idv === t.id }}
              style={{ borderWidth: 1.5, borderColor: idv === t.id ? C.pine700 : C.paper200, backgroundColor: idv === t.id ? C.mint100 : C.white, borderRadius: R.md, padding: 12, marginBottom: 8 }}>
              <Txt style={{ fontWeight: '700' }}>{t.label}</Txt><Small>{t.desc}</Small>
              <Tiny noTr>{`IDV ≈ ${inr(Math.round(cover * t.f))} · premium ${inr(Math.round(plan.indicativePremium * t.f))}`}</Tiny>
            </Pressable>
          ))}
        </>}
        {addOns.length > 0 && <>
          <Label style={{ marginVertical: 8 }}>{category === 'motor' ? 'Upgrades' : 'Optional add-ons'}</Label>
          {addOns.map((a: any) => {
            const on = sel.includes(a.id);
            return (
              <View key={a.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 1, borderColor: C.paper200, borderRadius: R.md, padding: 12, marginBottom: 8, backgroundColor: C.white }}>
                <View style={{ flex: 1 }}><Txt style={{ fontWeight: '700', fontSize: 14 }}>{a.name}</Txt><Small>{a.desc}</Small></View>
                <Button small kind={on ? 'primary' : 'secondary'} title={on ? '✓ Added' : `+ ${inr(a.price * 100)}`} noTr onPress={() => setSel((s) => on ? s.filter((x) => x !== a.id) : [...s, a.id])} />
              </View>
            );
          })}
        </>}
        <Card tone="paper" style={{ gap: 4, marginTop: 8 }}>
          <Row2 k="Base premium" v={inr(base)} />{addTotal > 0 && <Row2 k="Add-ons" v={inr(addTotal)} />}
          <Row2 k="Total (excl. GST)" v={`${inr(net)}/${per}`} bold />
        </Card>
        <Button title="Continue" style={{ marginTop: SP.md }} onPress={() => { setPhase('calculating'); setTimeout(() => setPhase('review'), 1600); }} />
      </>}
      {plan && phase === 'review' && <>
        <Card tone="paper" style={{ gap: 4 }}>
          <Row2 k={category === 'motor' ? 'Insured value (IDV)' : 'Cover'} v={inr(category === 'motor' ? idvValue : cover)} />
          <Row2 k="Valid till" v={prettyDate(new Date(Date.now() + 365 * 864e5).toISOString())} />
          <Row2 k="Net premium" v={inr(net)} /><Row2 k="GST (18%)" v={inr(gst)} /><Row2 k="Total premium (indicative)" v={inr(total)} bold />
        </Card>
        <Label style={{ marginTop: SP.lg, marginBottom: 8 }}>Your details</Label>
        <Input label="Full name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} autoComplete="name" />
        <Input label="Date of birth" value={form.dob} onChangeText={(v) => setForm({ ...form, dob: v })} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
        <Input label="Mobile" value={form.mobile} onChangeText={(v) => setForm({ ...form, mobile: v })} keyboardType="phone-pad" />
        <Input label="Email" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} keyboardType="email-address" autoCapitalize="none" />
        <Check checked={consent} onChange={setConsent}><Small>I’d like PayWatch to arrange this policy through its IRDAI-licensed insurance partner and share these details with them for a quote and KYC.</Small></Check>
        <Card style={{ backgroundColor: '#FBF0DF', marginTop: 8 }}><Tiny style={{ color: C.inkSoft }}>Issuance & payment are activating soon — no premium is collected now. This submits your application; the insurer confirms the final premium and terms.</Tiny></Card>
        {err ? <Small style={{ color: C.red, marginTop: 8 }}>{err}</Small> : null}
        <Button title="Continue with our licensed partner" style={{ marginTop: SP.md }} onPress={submit} loading={busy} disabled={!consent || !form.name} />
        <Button kind="ghost" title="Back" onPress={() => setPhase('configure')} />
      </>}
    </Sheet>
  );
}
const Row2 = ({ k, v, bold }: { k: string; v: string; bold?: boolean }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Small style={bold ? { fontWeight: '700', color: C.ink } : undefined}>{k}</Small><Num style={{ fontWeight: bold ? '800' : '500', fontSize: 14 }}>{v}</Num></View>
);
