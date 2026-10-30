// Statement scan — upload a bank statement (CSV / Excel / PDF) → a spending dashboard: where money went,
// where you could have saved, recurring payments, watch-outs. Transactions are imported (de-duplicated) and the plan re-runs.
import React, { useState } from 'react';
import { View } from 'react-native';
import { ask } from '@/lib/api';
import { notifyDataChanged } from '@/lib/api';
import { inr, prettyDate } from '@/lib/format';
import { pickFile, parseOnServer, TYPES } from '@/lib/files';
import { C, FONT, SP } from '@/lib/theme';
import { Bullets, Button, Card, Chip, Disclaimer, Label, Num, Orb, Screen, Section, Small, Soft, Stat, Tiny, Txt, H3 } from '@/components/ui';
import { Donut, Legend, PALETTE } from '@/components/charts';

export default function Statement() {
  const [stage, setStage] = useState<'idle' | 'reading' | 'analysing' | 'done'>('idle');
  const [rep, setRep] = useState<any>(null);
  const [meta, setMeta] = useState<{ imported: number; duplicates: number; warning?: string } | null>(null);
  const [err, setErr] = useState('');

  async function upload() {
    setErr('');
    try {
      const f = await pickFile([...TYPES.sheet, ...TYPES.pdf]);
      if (!f) return;
      setStage('reading');
      const r: any = await parseOnServer(f, 'statement');
      if (!r.transactions?.length) { setErr(r.warning || 'No transactions found in that file.'); setStage('idle'); return; }
      setStage('analysing');
      const a: any = await ask('/statements/analyze', { transactions: r.transactions.slice(0, 5000), persist: true }, 60000);
      setRep(a.report); setMeta({ imported: a.imported, duplicates: a.duplicates, warning: r.warning }); setStage('done');
      notifyDataChanged();
    } catch (e: any) { setErr(e.message); setStage('idle'); }
  }

  if (stage !== 'done' || !rep) return (
    <Screen>
      <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
        <Orb size={70} mode={stage === 'idle' ? 'idle' : 'thinking'} />
        <H3 style={{ textAlign: 'center' }}>{stage === 'reading' ? 'Reading your statement…' : stage === 'analysing' ? 'Finding where your money went…' : 'Upload a bank statement'}</H3>
        <Small style={{ textAlign: 'center' }}>CSV or Excel from net banking gives the most accurate result. PDFs work too (best-effort).</Small>
        <Button title="Choose file" icon="cloud-upload-outline" onPress={upload} loading={stage !== 'idle'} />
        {err ? <Small style={{ color: C.amber, textAlign: 'center' }}>{err}</Small> : null}
      </Card>
      <Disclaimer>Your transactions are stored securely to keep your plan up to date. Re-uploading the same statement skips duplicates.</Disclaimer>
    </Screen>
  );

  const donut = rep.byCategory.slice(0, 8).map((c: any, i: number) => ({ label: c.label, value: c.total, color: PALETTE[i % PALETTE.length] }));
  return (
    <Screen>
      <Card tone="dark">
        <Small noTr style={{ color: 'rgba(255,255,255,0.6)' }}>{`${prettyDate(rep.period.from)} – ${prettyDate(rep.period.to)} · ${rep.transactionCount} transactions`}</Small>
        <Txt style={{ color: C.white, fontSize: 16, lineHeight: 23, marginTop: 6 }}>{rep.summary}</Txt>
        {meta && <Tiny noTr style={{ color: C.mint300, marginTop: 8 }}>{`${meta.imported} new transactions imported${meta.duplicates ? ` · ${meta.duplicates} already there` : ''}`}</Tiny>}
      </Card>
      {meta?.warning ? <Card style={{ marginTop: 10, backgroundColor: '#FBF0DF' }}><Small>{meta.warning}</Small></Card> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <Stat style={{ minWidth: '45%' }} label="Money in" value={inr(rep.totals.inflow)} />
        <Stat style={{ minWidth: '45%' }} label="Money out" value={inr(rep.totals.outflow)} />
        <Stat style={{ minWidth: '45%' }} label="Net" value={inr(rep.totals.net)} />
        <Stat style={{ minWidth: '45%' }} label="Savings rate" value={rep.totals.savingsRate == null ? '—' : `${Math.round(rep.totals.savingsRate * 100)}%`} />
      </View>
      {rep.potentialAnnualSavings > 0 && (
        <Card tone="mint" style={{ marginTop: 12 }}>
          <Label style={{ color: C.pine700 }}>Where you could’ve saved</Label>
          <Num style={{ fontFamily: FONT.display, fontSize: 28, color: C.pine800, marginTop: 4 }}>{`${inr(rep.potentialAnnualSavings)}/yr`}</Num>
          {rep.reduceSuggestions.map((s: any, i: number) => (
            <View key={i} style={{ marginTop: 10 }}>
              <Txt style={{ fontWeight: '700', fontSize: 14 }}>{`${s.area} · ~${inr(s.potentialAnnualSaving)}/yr`}</Txt>
              <Small>{s.finding}</Small><Small style={{ color: C.pine800 }}>{`Tip: ${s.tip}`}</Small>
            </View>
          ))}
        </Card>
      )}
      <Section title="Where it went">
        <Card style={{ alignItems: 'center', gap: 14 }}>
          <Donut data={donut}><Tiny>Spent</Tiny><Num style={{ fontFamily: FONT.display, fontSize: 15 }} adjustsFontSizeToFit numberOfLines={1}>{inr(rep.totals.outflow)}</Num></Donut>
          <Legend data={donut} money />
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignSelf: 'stretch' }}>
            <Chip label={`Essentials ${inr(rep.split.essential)}`} bg={C.paper100} color={C.inkSoft} />
            <Chip label={`Flexible ${inr(rep.split.discretionary)}`} bg="#FBF0DF" color={C.amber} />
            <Chip label={`Invested ${inr(rep.split.investments)}`} />
          </View>
        </Card>
      </Section>
      {rep.topMerchants?.length > 0 && <Section title="Top merchants"><Card>{rep.topMerchants.slice(0, 8).map((m: any, i: number) => (
        <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: C.paper100 }}>
          <Small noTr style={{ flex: 1 }} numberOfLines={1}>{`${m.description} · ${m.count}×`}</Small><Num style={{ fontWeight: '700', fontSize: 14 }}>{inr(m.total)}</Num></View>))}</Card></Section>}
      {rep.largestExpenses?.length > 0 && <Section title="Largest expenses"><Card>{rep.largestExpenses.slice(0, 6).map((m: any, i: number) => (
        <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: C.paper100 }}>
          <View style={{ flex: 1 }}><Small noTr numberOfLines={1}>{m.description}</Small><Tiny noTr>{prettyDate(m.date)}</Tiny></View><Num style={{ fontWeight: '700', fontSize: 14 }}>{inr(m.amount)}</Num></View>))}</Card></Section>}
      {rep.recurring?.length > 0 && <Section title="Recurring payments"><Card>{rep.recurring.map((r: any, i: number) => (
        <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}><Small noTr style={{ flex: 1 }} numberOfLines={1}>{`${r.description} · ${r.occurrences}×`}</Small><Num style={{ fontSize: 14 }}>{`${inr(r.avgAmount)}/mo`}</Num></View>))}</Card></Section>}
      {(rep.watchOuts?.length > 0 || rep.positives?.length > 0) && <Section title="What stands out"><Card style={{ gap: 10 }}>
        {rep.watchOuts?.length > 0 && <Bullets items={rep.watchOuts.map((w: any) => w.message)} mark="!" color={C.amber} />}
        {rep.positives?.length > 0 && <Bullets items={rep.positives} mark="✓" color={C.green} />}
      </Card></Section>}
      <Button kind="secondary" title="Scan another statement" style={{ marginTop: SP.lg }} onPress={() => { setStage('idle'); setRep(null); }} />
      <Disclaimer>{rep.disclaimer}</Disclaimer>
    </Screen>
  );
}
