// Net worth — what you own minus what you owe, your mix, where it's heading, and this month's spending.
import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useApi } from '@/lib/hooks';
import { patch } from '@/lib/api';
import { inr, pct } from '@/lib/format';
import { C, FONT, R, SP } from '@/lib/theme';
import { Bar, Button, Card, Chip, Disclaimer, ErrorBox, Label, Loading, Num, Screen, Section, Segmented, Small, Soft, Tiny, Txt, Row } from '@/components/ui';
import { ALLOC_COLORS, Donut, HBars, Legend } from '@/components/charts';

const ALLOC: Record<string, string> = { equity: 'Equity', debt: 'Debt', realEstate: 'Real estate', gold: 'Gold', cash: 'Cash' };
const CAT: Record<string, string> = { food: 'Food & dining', groceries: 'Groceries', shopping: 'Shopping', transport: 'Transport', bills: 'Bills & utilities', rent: 'Rent', entertainment: 'Entertainment', health: 'Health', education: 'Education', travel: 'Travel', emi: 'EMIs', investment: 'Investments', transfer: 'Transfers', other: 'Other' };

export default function NetWorth() {
  const nw = useApi<any>('/networth');
  const spend = useApi<any>('/spend/summary');
  const [hi, setHi] = useState(0);
  const d = nw.data;
  if (nw.loading && !d) return <Screen><Loading /></Screen>;
  if (!d) return <Screen><ErrorBox message={nw.error || 'Could not load'} onRetry={nw.reload} /></Screen>;

  const donut = Object.entries(d.allocation || {}).filter(([, v]: any) => Number(v) > 0).map(([k, v]: any) => ({ label: ALLOC[k] || k, value: Number(v), color: ALLOC_COLORS[k] || C.inkFaint }));
  const g = d.growth; const h = g?.horizons?.[hi];
  const months = spend.data?.by_category ? Array.from(new Set<string>(spend.data.by_category.map((r: any) => r.month))).slice(0, 1) : [];
  const monthSpend = (spend.data?.by_category || []).filter((r: any) => r.month === months[0]);

  return (
    <Screen onRefresh={() => { nw.reload(); spend.reload(); }} refreshing={nw.refreshing}>
      <Card>
        <Label>Total net worth</Label>
        <Num style={{ fontFamily: FONT.display, fontSize: 36, marginTop: 4 }} adjustsFontSizeToFit numberOfLines={1}>{inr(d.netWorth)}</Num>
        {d.totalAssets + d.totalLiabilities > 0 && <>
          <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 14, backgroundColor: C.paper100 }}>
            <View style={{ flex: d.totalAssets || 0.0001, backgroundColor: C.pine700 }} />
            <View style={{ flex: d.totalLiabilities || 0.0001, backgroundColor: C.amber }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Small noTr>Assets {inr(d.totalAssets)}</Small><Small noTr>Liabilities {inr(d.totalLiabilities)}</Small>
          </View>
        </>}
        <Tiny style={{ marginTop: 10 }}>{`${pct(d.liquidityRatio)} of your assets are liquid (reachable within a day).`}</Tiny>
      </Card>

      <Section title="Asset mix">
        <Card style={{ alignItems: 'center', gap: 16 }}>
          {donut.length ? <>
            <Donut data={donut}><Tiny>Assets</Tiny><Num style={{ fontFamily: FONT.display, fontSize: 16 }} adjustsFontSizeToFit numberOfLines={1}>{inr(d.totalAssets)}</Num></Donut>
            <Legend data={donut} />
          </> : <Soft>Add assets in Settings to see your mix.</Soft>}
        </Card>
      </Section>

      {d.allocationAnalysis?.available && (
        <Section title="Investment allocation" sub={`Your ${inr(d.allocationAnalysis.investedTotal)} of investments vs the suggested share for a ${d.allocationAnalysis.riskProfile} risk level.`}>
          <Card style={{ gap: 18 }}>
            {d.allocationAnalysis.classes.map((c: any) => {
              const col = c.status === 'over' ? C.amber : c.status === 'under' ? C.pine500 : C.green;
              const tag = c.status === 'over' ? `Over by ${c.deltaPct}%` : c.status === 'under' ? `Under by ${-c.deltaPct}%` : 'On track';
              return (
                <View key={c.key}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Txt style={{ fontWeight: '700' }}>{c.label}</Txt><Chip label={tag} bg={col + '22'} color={col} />
                  </View>
                  <View style={{ height: 14, borderRadius: 7, backgroundColor: C.paper100, overflow: 'hidden' }}>
                    <View style={{ width: `${Math.min(100, c.currentPct)}%`, height: 14, backgroundColor: col }} />
                    <View style={{ position: 'absolute', left: `${Math.min(100, c.targetPct)}%`, top: 0, bottom: 0, borderLeftWidth: 2, borderColor: C.pine900 }} />
                  </View>
                  <Small noTr style={{ marginTop: 4 }}>{`You: ${c.currentPct}% · Suggested: ${c.targetPct}%`}</Small>
                  <Small style={{ marginTop: 2 }}>{c.note}</Small>
                </View>
              );
            })}
            <Tiny>Educational asset-class guidance based on your age and risk level — never a specific product, and not investment advice.</Tiny>
          </Card>
        </Section>
      )}

      {g?.available && h && (
        <Section title="Grow your net worth" sub="Same start — the difference is a few habits.">
          <View style={{ borderRadius: R.lg, padding: SP.lg, backgroundColor: C.pine950 }}>
            <Segmented dark value={hi} onChange={setHi} options={g.horizons.map((x: any, i: number) => ({ v: i, label: `${x.years}y` }))} />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <View style={{ flex: 1 }}><Tiny style={{ color: 'rgba(255,255,255,0.5)' }}>DO NOTHING</Tiny><Num style={{ color: C.white, fontFamily: FONT.display, fontSize: 20 }} adjustsFontSizeToFit numberOfLines={1}>{inr(h.baseline)}</Num>
                <View style={{ marginTop: 6 }}><Bar value={h.improved ? h.baseline / h.improved : 0} color="rgba(255,255,255,0.35)" track="rgba(255,255,255,0.1)" /></View></View>
              <View style={{ flex: 1 }}><Tiny style={{ color: C.mint300 }}>BUILD THESE HABITS</Tiny><Num style={{ color: C.mint300, fontFamily: FONT.display, fontSize: 20 }} adjustsFontSizeToFit numberOfLines={1}>{inr(h.improved)}</Num>
                <View style={{ marginTop: 6 }}><Bar value={1} color={C.mint500} track="rgba(255,255,255,0.1)" /></View></View>
            </View>
            <Small noTr style={{ color: 'rgba(255,255,255,0.8)', marginTop: 12 }}>{`In ${h.years} years that’s about ${inr(h.uplift)} more.`}</Small>
            {(g.levers || []).map((l: string, i: number) => <Small key={i} style={{ color: 'rgba(255,255,255,0.85)', marginTop: 6 }}>{`→ ${l}`}</Small>)}
            <Small noTr style={{ color: 'rgba(255,255,255,0.6)', marginTop: 14 }}>{`Risk level: ${g.riskAppetite} · assumes ~${g.assumedReturnPct}%/yr`}</Small>
            <Segmented dark style={{ marginTop: 8 }} value={g.riskAppetite} onChange={(r: string) => patch('/user/me', { risk_appetite: r })}
              options={[{ v: 'conservative', label: 'Cautious' }, { v: 'moderate', label: 'Balanced' }, { v: 'aggressive', label: 'Growth' }]} />
            <Button kind="mint" small title="Show me how" style={{ marginTop: 14, alignSelf: 'flex-start' }} onPress={() => router.push('/actions')} />
            <Tiny style={{ color: 'rgba(255,255,255,0.4)', marginTop: 10 }}>Illustration, not a guarantee — markets fluctuate. Nominal, before inflation.</Tiny>
          </View>
        </Section>
      )}

      <Section title="Holdings">
        <Card style={{ paddingVertical: 4 }}>
          <Label style={{ marginTop: 10 }}>Assets</Label>
          {d.assets.length ? d.assets.map((a: any, i: number) => <Row key={a.label} title={a.label} subtitle={a.liquid ? 'Liquid' : undefined} right={<Num style={{ fontWeight: '700' }}>{inr(a.value)}</Num>} last={i === d.assets.length - 1} />) : <Small style={{ paddingVertical: 10 }}>No assets added yet.</Small>}
        </Card>
        <Card style={{ paddingVertical: 4, marginTop: 12 }}>
          <Label style={{ marginTop: 10 }}>Liabilities</Label>
          {d.liabilities.length ? d.liabilities.map((l: any, i: number) => <Row key={l.label} title={l.label} right={<Num style={{ fontWeight: '700', color: C.red }}>−{inr(l.value)}</Num>} last={i === d.liabilities.length - 1} />) : <Small style={{ paddingVertical: 10, color: C.green }}>Debt-free — nothing owed. 🎉</Small>}
        </Card>
        <Button kind="ghost" title="Edit in Settings" onPress={() => router.push('/settings')} />
      </Section>

      {monthSpend.length > 0 && (
        <Section title="This month’s spending">
          <Card>
            <HBars rows={monthSpend.map((r: any) => ({ label: CAT[r.category] || r.category, value: Number(r.total) }))} />
            {spend.data?.recurring?.length > 0 && <>
              <Label style={{ marginTop: 16, marginBottom: 6 }}>Recurring charges</Label>
              {spend.data.recurring.map((s: any) => <Small noTr key={s.description} style={{ marginTop: 4 }}>{`${s.description} · ${inr(s.avg_amount)}/mo · ${inr(Number(s.avg_amount) * 12)}/yr`}</Small>)}
            </>}
          </Card>
        </Section>
      )}
      <Disclaimer>Figures come from what you’ve entered and uploaded. Educational, not investment advice.</Disclaimer>
    </Screen>
  );
}
