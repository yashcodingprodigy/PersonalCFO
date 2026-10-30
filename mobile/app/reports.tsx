// Monthly money report — score, snapshot, actions, tax, cover, goals and an insight of the month. Shareable as text.
import React from 'react';
import { View } from 'react-native';
import { useApi } from '@/lib/hooks';
import { inr, pct } from '@/lib/format';
import { shareText } from '@/lib/files';
import { C, FONT, SP } from '@/lib/theme';
import { Bar, Button, Card, Disclaimer, ErrorBox, Label, Loading, Num, Screen, Section, Small, Stat, Tiny, Txt } from '@/components/ui';

export default function Reports() {
  const { data: r, loading, error, reload, refreshing } = useApi<any>('/reports/current');
  if (loading && !r) return <Screen><Loading /></Screen>;
  if (!r) return <Screen><ErrorBox message={error || 'Could not load'} onRetry={reload} /></Screen>;
  const s = r.snapshot || {};
  const share = () => shareText(`paywatch-report-${String(r.month).replace(/\s/g, '-')}.txt`, [
    `PayWatch — Money report, ${r.month}`, '', `Money Health Score: ${r.score.current}${r.score.vs_last_month != null ? ` (${r.score.vs_last_month >= 0 ? '+' : ''}${r.score.vs_last_month} vs last month)` : ''}`,
    `Net worth: ${inr(s.net_worth)}  (assets ${inr(s.total_assets)}, liabilities ${inr(s.total_liabilities)})`, `Monthly income: ${inr(s.monthly_income)} · spending: ${inr(s.monthly_expenses)}`,
    s.savings_rate != null ? `Savings rate: ${Math.round(s.savings_rate * 100)}%` : '', '', `Actions done this month: ${r.actions.completed_this_month} · open: ${r.actions.open}`,
    ...(r.actions.top_priorities || []).map((a: any) => `  → ${a.title}`), '', `Tax (FY ${r.tax.fy}): ${r.tax.recommended_regime} regime saves ${inr(r.tax.savings_vs_other)}`,
    r.insight_of_the_month ? `\nInsight: ${r.insight_of_the_month}` : '', '', r.disclaimer,
  ].join('\n')).catch(() => {});
  return (
    <Screen onRefresh={reload} refreshing={refreshing}>
      <Card tone="dark">
        <Txt noTr style={{ color: C.mint300, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 }}>{String(r.month).toUpperCase()}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 6 }}>
          <Num style={{ color: C.white, fontFamily: FONT.display, fontSize: 44 }}>{r.score.current}</Num>
          <Small style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>Money Health Score</Small>
        </View>
        {r.score.vs_last_month != null && <Small noTr style={{ color: r.score.vs_last_month >= 0 ? C.mint300 : C.coral }}>{`${r.score.vs_last_month >= 0 ? '▲' : '▼'} ${Math.abs(r.score.vs_last_month)} vs last month`}</Small>}
      </Card>
      {r.insight_of_the_month && <Card tone="mint" style={{ marginTop: 12 }}><Label style={{ color: C.pine700 }}>Insight of the month</Label><Small style={{ marginTop: 4 }}>{r.insight_of_the_month}</Small></Card>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <Stat style={{ minWidth: '45%' }} label="Net worth" value={inr(s.net_worth)} />
        <Stat style={{ minWidth: '45%' }} label="Savings rate" value={s.savings_rate == null ? '—' : pct(s.savings_rate * 100)} />
        <Stat style={{ minWidth: '45%' }} label="Income / mo" value={inr(s.monthly_income)} />
        <Stat style={{ minWidth: '45%' }} label="Spending / mo" value={inr(s.monthly_expenses)} />
      </View>
      {r.score.dimensions?.length > 0 && <Section title="Score breakdown"><Card style={{ gap: 12 }}>
        {r.score.dimensions.filter((d: any) => d.available !== false).map((d: any) => (
          <View key={d.key || d.name}><View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}><Small>{d.label || d.name}</Small><Num style={{ fontWeight: '700', fontSize: 13 }}>{Math.round(d.score)}</Num></View><Bar value={(d.score || 0) / 100} /></View>
        ))}
      </Card></Section>}
      <Section title="This month’s actions"><Card>
        <Small noTr>{`${r.actions.completed_this_month} done · ${r.actions.open} open`}</Small>
        {(r.actions.top_priorities || []).map((a: any, i: number) => <Txt noTr key={i} style={{ fontSize: 14.5, marginTop: 6 }}>{`→ ${a.title}`}</Txt>)}
      </Card></Section>
      <Section title="Tax"><Card><Small noTr>{`FY ${r.tax.fy} · ${r.tax.recommended_regime} regime saves ${inr(r.tax.savings_vs_other)}`}</Small><Small style={{ marginTop: 4 }}>{r.tax.reasoning}</Small></Card></Section>
      {r.goals?.length > 0 && <Section title="Goals"><Card style={{ gap: 10 }}>{r.goals.map((g: any, i: number) => (
        <View key={i}><Txt noTr style={{ fontWeight: '600', fontSize: 14 }}>{g.name}</Txt>{g.math?.progressPct != null && <Bar value={g.math.progressPct / 100} />}</View>))}</Card></Section>}
      <Button title="Share this report" icon="share-outline" style={{ marginTop: SP.xl }} onPress={share} />
      <Disclaimer>{r.disclaimer}</Disclaimer>
    </Screen>
  );
}
