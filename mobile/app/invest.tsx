// Invest — SEBI-safe guidance: your investor type, target mix, fund CATEGORIES (never named
// products), a portfolio X-ray from your holdings file, templates and how to start.
import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useApi } from '@/lib/hooks';
import { ask, post } from '@/lib/api';
import { inr, inrApprox } from '@/lib/format';
import { pickFile, parseOnServer, TYPES } from '@/lib/files';
import { C, FONT, SP } from '@/lib/theme';
import { Bar, Bullets, Button, Card, Chip, Disclaimer, Disclosure, ErrorBox, Label, Loading, Num, Screen, Section, Small, Soft, Tiny, Txt, H2 } from '@/components/ui';
import { Donut, Legend, PALETTE } from '@/components/charts';

const BUCKET_COLOR: Record<string, string> = { equity: C.pine700, debt: C.mint500, gold: C.amber };
const BUCKET_LABEL: Record<string, string> = { equity: 'Equity (growth)', debt: 'Debt (stability)', gold: 'Gold (cushion)' };
const RISK: Record<string, string> = { conservative: 'Play it safe', moderate: 'Balanced', aggressive: 'Go for growth' };
const GRADE: Record<string, string> = { A: C.mint300, B: C.mint300, C: C.gold, D: C.coral, E: C.coral, F: C.coral };

export default function Invest() {
  const { data: g, loading, error, reload, refreshing } = useApi<any>('/invest');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  if (loading && !g) return <Screen><Loading /></Screen>;
  if (!g) return <Screen><ErrorBox message={error || 'Could not load'} onRetry={reload} /></Screen>;
  if (!g.hasIncome) return <Screen><Card><Soft>{g.investableExplanation}</Soft><Button title="Add my income" style={{ marginTop: 12 }} onPress={() => router.push('/settings')} /></Card></Screen>;
  const t = g.targetAllocation;
  const donut = (['equity', 'debt', 'gold'] as const).filter((k) => t[k] > 0).map((k) => ({ label: BUCKET_LABEL[k], value: t[k], color: BUCKET_COLOR[k] }));

  const started = async (category: string, monthlyAmount: number) => {
    setBusy(category); setErr('');
    try { await post('/invest/started', { category, monthlyAmount }); } catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };

  return (
    <Screen onRefresh={reload} refreshing={refreshing}>
      <Soft>A personalised, beginner-friendly plan — fund categories, never specific products.</Soft>
      {err ? <Small style={{ color: C.red, marginTop: 6 }}>{err}</Small> : null}
      {(g.emergencyFirst || g.highCostDebtFirst) && (
        <Card style={{ marginTop: SP.lg, borderLeftWidth: 4, borderLeftColor: C.amber }}>
          <Label style={{ color: C.amber }}>Do this first</Label>
          {g.highCostDebtFirst && <Small style={{ marginTop: 6 }}>{g.debtMessage}</Small>}
          {g.emergencyFirst && <Small style={{ marginTop: 6 }}>{g.emergencyMessage}</Small>}
        </Card>
      )}

      <View style={{ flexDirection: 'row', gap: 12, marginTop: SP.lg }}>
        <Card style={{ flex: 1 }}>
          <Label>Investor type</Label>
          <Txt style={{ fontFamily: FONT.display, fontSize: 20, marginTop: 4 }}>{RISK[g.riskProfile] || g.riskProfile}</Txt>
          <Tiny style={{ marginTop: 4 }}>{g.riskWasExplicit ? 'Based on the comfort you chose.' : 'Estimated from your age and situation.'}</Tiny>
        </Card>
        <Card style={{ flex: 1 }}>
          <Label>Suggested / month</Label>
          <Num style={{ fontFamily: FONT.display, fontSize: 24, color: C.pine700, marginTop: 4 }} adjustsFontSizeToFit numberOfLines={1}>{inrApprox(g.monthlyInvestable)}</Num>
          <Tiny style={{ marginTop: 4 }}>~70% of what’s free, keeping a buffer.</Tiny>
        </Card>
      </View>
      {g.surplus > 0 && (
        <Card style={{ marginTop: 12, gap: 6 }}>
          {[['Monthly take-home', inr(g.takeHome)], ['Typical expenses', `−${inr(g.monthlyExpenses)}`], ['Free each month', inr(g.surplus)], ...(g.currentSip > 0 ? [['You already invest', inr(g.currentSip)]] : [])].map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Small>{k}</Small><Num style={{ fontWeight: '600' }}>{v}</Num></View>
          ))}
        </Card>
      )}

      <Section title="Your target mix" sub="How to split each rupee you invest.">
        <Card style={{ alignItems: 'center', gap: 14 }}>
          <Donut data={donut}><Tiny>Equity</Tiny><Num style={{ fontFamily: FONT.display, fontSize: 24 }}>{t.equity}%</Num></Donut>
          <Legend data={donut} total={100} />
          {g.allocationGap?.length > 0 && <View style={{ alignSelf: 'stretch', borderTopWidth: 1, borderTopColor: C.paper100, paddingTop: 10 }}><Bullets items={g.allocationGap} /></View>}
        </Card>
      </Section>

      <Section title="Your monthly plan" sub="Tap any item for the why & how.">
        {g.recommendations.length === 0 && <Card><Soft>You’ve recorded everything in this plan. 🎉 Update income or risk in Settings for a fresh plan.</Soft></Card>}
        <View style={{ gap: 10 }}>
          {g.recommendations.map((r: any, i: number) => (
            <Disclosure key={i} title={r.category} subtitle={`${r.allocationPct}% of plan`}
              left={<View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: BUCKET_COLOR[r.bucket] || C.inkFaint }} />}
              right={<Num style={{ fontFamily: FONT.display, fontSize: 16 }}>{inrApprox(r.monthlyAmount)}/mo</Num>}>
              <Small>{r.whatItIs}</Small>
              <Small style={{ color: C.pine800, marginTop: 8 }}>{`Why for you: ${r.whyForYou}`}</Small>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                <Chip label={r.liquidity} bg={C.paper100} color={C.inkSoft} />
                <Chip label={`Lock-in: ${r.lockIn}`} bg={C.paper100} color={C.inkSoft} />
                <Chip label={r.taxNote} bg={C.paper100} color={C.inkSoft} />
              </View>
              <Button kind="mint" small style={{ marginTop: 12, alignSelf: 'flex-start' }} title="✓ I’ve started this — add to my data" loading={busy === r.category} onPress={() => started(r.category, r.monthlyAmount)} />
              <Tiny style={{ marginTop: 4 }}>Records it in your investments and removes it from this plan.</Tiny>
            </Disclosure>
          ))}
        </View>
      </Section>

      <Section title="Portfolio X-ray" sub="Already investing? Upload your holdings export to see how diversified you really are."><Xray /></Section>

      <Section title="Ready-made templates">
        <View style={{ gap: 10 }}>
          {g.modelPortfolios.map((m: any) => (
            <Card key={m.key} style={m.matchesYou ? { borderWidth: 2, borderColor: C.pine700 } : undefined}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Txt style={{ fontWeight: '700' }}>{m.name}</Txt>{m.matchesYou && <Chip label="Matches you" />}
              </View>
              <Tiny style={{ marginBottom: 8 }}>{m.tagline}</Tiny>
              <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' }}>
                {m.mix.map((x: any, j: number) => <View key={j} style={{ flex: x.pct, backgroundColor: PALETTE[j % PALETTE.length] }} />)}
              </View>
              <View style={{ marginTop: 8, gap: 4 }}>
                {m.mix.map((x: any, j: number) => <View key={j} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Small>{x.label}</Small><Num style={{ fontSize: 13 }}>{x.pct}%</Num></View>)}
              </View>
            </Card>
          ))}
        </View>
      </Section>

      <Section title="How to actually start"><Card><Bullets items={g.startSteps.map((s: string, i: number) => `${i + 1}. ${s}`)} mark="" /></Card></Section>
      <Section title="Keeping it healthy"><Card><Bullets items={g.rebalanceNotes} /></Card></Section>
      <Disclaimer>{g.disclaimer || 'Educational guidance on fund categories — not investment advice. PayWatch does not recommend specific securities or schemes.'}</Disclaimer>
    </Screen>
  );
}

function Xray() {
  const [stage, setStage] = useState<'idle' | 'busy' | 'done'>('idle');
  const [a, setA] = useState<any>(null);
  const [msg, setMsg] = useState('');
  async function upload() {
    setMsg('');
    try {
      const f = await pickFile(TYPES.sheet);
      if (!f) return;
      setStage('busy');
      const { holdings, warning } = await parseOnServer<{ holdings: any[]; warning?: string }>(f, 'holdings');
      if (!holdings?.length) { setMsg(warning || 'No holdings found in that file.'); setStage('idle'); return; }
      setA(await ask('/holdings/analyze', { holdings })); setStage('done');
    } catch (e: any) { setMsg(e.message); setStage('idle'); }
  }
  if (stage !== 'done' || !a) return (
    <Card style={{ alignItems: 'center', gap: 8 }}>
      <Txt style={{ fontWeight: '700' }}>Upload your holdings (CSV / Excel)</Txt>
      <Small style={{ textAlign: 'center' }}>Export from your broker or MF app, or a CDSL/NSDL statement. The file is read once and not stored.</Small>
      <Button small title={stage === 'busy' ? 'Analysing…' : 'Choose file'} icon="cloud-upload-outline" loading={stage === 'busy'} onPress={upload} />
      {msg ? <Small style={{ color: C.amber, textAlign: 'center' }}>{msg}</Small> : null}
    </Card>
  );
  return (
    <View style={{ gap: 12 }}>
      <Card tone="dark" style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <View style={{ alignItems: 'center' }}><Txt noTr style={{ fontFamily: FONT.display, fontSize: 44, color: GRADE[a.grade] || C.white }}>{a.grade}</Txt><Tiny style={{ color: 'rgba(255,255,255,0.5)' }}>Diversification</Tiny></View>
        <View style={{ flex: 1 }}>
          <Small style={{ color: 'rgba(255,255,255,0.85)' }}>{a.summary}</Small>
          <Tiny noTr style={{ color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>{`${a.count} holdings · ${inr(a.total)} · score ${a.score}/100`}</Tiny>
        </View>
      </Card>
      <Card style={{ gap: 12 }}>
        <Label>By asset class</Label>
        {a.byAssetClass.map((c: any, i: number) => (
          <View key={c.key}><View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}><Small>{c.label}</Small><Num style={{ fontWeight: '700' }}>{c.pct}%</Num></View><Bar value={c.pct / 100} color={PALETTE[i % PALETTE.length]} /></View>
        ))}
        {a.bySector?.length > 0 && <>
          <Label style={{ marginTop: 6 }}>Direct stocks by sector</Label>
          {a.bySector.map((s: any, i: number) => (
            <View key={i}><View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}><Small>{s.sector}</Small><Num style={{ fontWeight: '700' }}>{s.pct}%</Num></View><Bar value={s.pct / 100} color={PALETTE[(i + 3) % PALETTE.length]} /></View>
          ))}
        </>}
      </Card>
      {a.flags?.length > 0 && <Card><Label>What stands out</Label><View style={{ marginTop: 8 }}><Bullets items={a.flags.map((f: any) => f.text || f.message || f.title || String(f))} color={C.amber} /></View></Card>}
      <Button kind="secondary" small title="Upload another" onPress={() => { setStage('idle'); setA(null); }} />
      <Tiny>Classifications are best-effort from holding names. Educational analysis of diversification — not a recommendation to buy or sell.</Tiny>
    </View>
  );
}
