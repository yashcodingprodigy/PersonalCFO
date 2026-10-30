// Tax — full computation (every income head, both regimes), old vs new, plan-ahead copilot,
// ways to reduce tax, deduction tracker, calendar, and terms. Prepare & self-file; works alongside your CA.
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useApi } from '@/lib/hooks';
import { groupIN, inr, prettyDate } from '@/lib/format';
import { shareText } from '@/lib/files';
import { C, FONT, R, SP } from '@/lib/theme';
import { Bar, Bullets, Button, Card, Chip, Disclaimer, Disclosure, ErrorBox, Label, Loading, Num, Screen, Small, Soft, Tiny, Txt, H3 } from '@/components/ui';

const TABS = [
  { id: 'computation', label: 'Computation' }, { id: 'regime', label: 'Old vs new' }, { id: 'copilot', label: 'Plan ahead' },
  { id: 'reduce', label: 'Reduce tax' }, { id: 'deductions', label: 'Deductions' }, { id: 'calendar', label: 'Calendar' }, { id: 'terms', label: 'Terms' },
];
const R_ = (v: number) => `₹${groupIN((v || 0) / 100)}`;
const Line = ({ k, v, bold, color }: { k: string; v: string; bold?: boolean; color?: string }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
    <Small style={[{ flex: 1 }, bold && { color: C.ink, fontWeight: '700' }]}>{k}</Small>
    <Num style={{ fontSize: 14, fontWeight: bold ? '800' : '500', color: color || C.ink }}>{v}</Num>
  </View>
);

export default function Tax() {
  const tax = useApi<any>('/tax');
  const full = useApi<any>('/tax/full');
  const [tab, setTab] = useState('computation');
  const t = tax.data;
  if (tax.loading && !t) return <Screen><Loading /></Screen>;
  if (!t) return <Screen><ErrorBox message={tax.error || 'Could not load'} onRetry={tax.reload} /></Screen>;
  const c = t.comparison, d = t.deductions, rp = t.reductionPlan;
  const noTax = c && c.oldRegime.tax === 0 && c.newRegime.tax === 0;
  const maxTax = c ? Math.max(c.oldRegime.tax, c.newRegime.tax, 1) : 1;

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: C.paper200 }} contentContainerStyle={{ paddingHorizontal: SP.lg, paddingVertical: 10, gap: 8 }}>
        {TABS.map((x) => (
          <Pressable key={x.id} onPress={() => setTab(x.id)} accessibilityRole="tab" accessibilityState={{ selected: tab === x.id }}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill, backgroundColor: tab === x.id ? C.pine900 : C.white, borderWidth: 1, borderColor: tab === x.id ? C.pine900 : C.paper200 }}>
            <Txt style={{ fontSize: 13, fontWeight: '700', color: tab === x.id ? C.white : C.inkSoft }}>{x.label}</Txt>
          </Pressable>
        ))}
      </ScrollView>
      <Screen onRefresh={() => { tax.reload(); full.reload(); }} refreshing={tax.refreshing}>
        <Small noTr>{`Financial year ${t.fy}`}</Small>

        {tab === 'computation' && <>
          {full.data ? <Full f={full.data} /> : full.loading ? <Loading /> : null}
          {noTax && <Card style={{ marginTop: SP.md, borderLeftWidth: 4, borderLeftColor: C.green }}><Small><Txt style={{ color: C.green, fontWeight: '700', fontSize: 13 }}>Good news — you owe no income tax yet. </Txt>At your income, the new regime’s rebate covers you fully.</Small></Card>}
        </>}

        {tab === 'regime' && c && <View style={{ gap: 12, marginTop: SP.md }}>
          {[c.oldRegime, c.newRegime].map((r: any) => (
            <Card key={r.regime} style={c.recommended === r.regime ? { borderWidth: 2, borderColor: C.pine700 } : undefined}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Label>{`${r.regime} regime`}</Label>{c.recommended === r.regime && <Chip label="Saves you more" />}</View>
              <Num style={{ fontFamily: FONT.display, fontSize: 30, marginTop: 6 }}>{inr(r.tax)}</Num>
              <Tiny>estimated tax this FY</Tiny>
              <View style={{ marginVertical: 10 }}><Bar value={r.tax / maxTax} color={c.recommended === r.regime ? C.pine700 : C.inkFaint} /></View>
              <Line k="Gross income" v={inr(r.grossIncome)} /><Line k="Deductions" v={`−${inr(r.totalDeductions)}`} />
              <Line k="Taxable income" v={inr(r.taxableIncome)} bold /><Line k="Effective rate" v={`${(r.effectiveRate * 100).toFixed(1)}%`} />
            </Card>
          ))}
          <Card tone="mint"><Small>{c.reasoning}</Small></Card>
        </View>}

        {tab === 'copilot' && t.copilot && <Copilot c={t.copilot} />}

        {tab === 'reduce' && rp && <View style={{ gap: 10, marginTop: SP.md }}>
          <Soft>{`Each extra ₹100 of deduction saves about ₹${rp.marginalRatePct}.${rp.totalPotentialSaving > 0 ? ` Up to ${inr(rp.totalPotentialSaving)} in total.` : ''}`}</Soft>
          {rp.newRegimeNote ? <Card tone="paper"><Small>{rp.newRegimeNote}</Small></Card> : null}
          {rp.steps.map((s: any, i: number) => (
            <Disclosure key={i} title={s.title} subtitle={s.section} right={s.taxSaved > 0 ? <Num style={{ color: C.green, fontWeight: '700' }}>{`−${inr(s.taxSaved)}`}</Num> : undefined}>
              <Small>{s.whatItMeans}</Small><Small style={{ color: C.pine800, marginTop: 8 }}>{`How: ${s.howTo}`}</Small>
            </Disclosure>
          ))}
          {rp.capitalGains && <Disclosure title={rp.capitalGains.title} subtitle="Tax on investment profits — the basics"><Bullets items={rp.capitalGains.points} /></Disclosure>}
          <Tiny>Update amounts in Settings → Tax data to make these exact.</Tiny>
        </View>}

        {tab === 'deductions' && d && <Card style={{ gap: 14, marginTop: SP.md }}>
          <Small>How much of each limit you’ve used (old regime).</Small>
          {d.items.map((i: any) => { const p = Math.min(1, i.used / (i.limit || 1)); return (
            <View key={i.section}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}><Txt noTr style={{ fontWeight: '700', fontSize: 14 }}>{i.section}</Txt><Num style={{ fontSize: 13, color: C.inkSoft }}>{`${inr(i.used)} of ${inr(i.limit)}`}</Num></View>
              <Bar value={p} color={p >= 1 ? C.green : C.pine700} />
            </View>
          ); })}
        </Card>}

        {tab === 'calendar' && <Card style={{ marginTop: SP.md }}>
          {(t.calendar || []).map((e: any, i: number) => (
            <View key={e.month} style={{ flexDirection: 'row', gap: 12, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: C.paper100 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.pine700, marginTop: 6 }} />
              <View style={{ flex: 1 }}><Txt style={{ fontWeight: '700', color: C.pine800 }}>{e.month}</Txt><Small>{e.message}</Small></View>
            </View>
          ))}
        </Card>}

        {tab === 'terms' && rp && <View style={{ gap: 12, marginTop: SP.md }}>
          <Card onPress={() => router.push('/tax/file')}><H3>File your ITR yourself →</H3><Small>Step-by-step guide for the government portal, using your computed numbers.</Small></Card>
          <Card onPress={() => router.push('/ca')}><H3>Hand it to your CA →</H3><Small>Connect your own CA and share documents securely.</Small></Card>
          {rp.checklist?.length > 0 && <Card><Label>Documents to keep ready</Label><View style={{ marginTop: 8 }}><Bullets items={rp.checklist} /></View></Card>}
          {rp.glossary?.length > 0 && <Card style={{ gap: 10 }}><Label>Glossary</Label>{rp.glossary.map((g: any, i: number) => <View key={i}><Txt style={{ fontWeight: '700', fontSize: 14 }}>{g.term}</Txt><Small>{g.meaning}</Small></View>)}</Card>}
        </View>}
        <Disclaimer>Estimates for planning and self-filing, based on current rules and your data. Cross-check with Form 26AS / AIS before filing. Audits and certain certifications need a Chartered Accountant.</Disclaimer>
      </Screen>
    </View>
  );
}

function Full({ f }: { f: any }) {
  const i = f.inputs, rec = f.recommendedRegime === 'old' ? f.old : f.new, other = f.recommendedRegime === 'old' ? f.new : f.old;
  const income = ([['Salary (gross)', i.grossSalary], ['Interest income', i.interestIncome], ['House property', i.housePropertyIncome], ['Other (dividends, etc.)', i.otherIncome],
    ['Business / profession', i.businessIncome], ['Short-term capital gains (equity)', i.stcgEquity], ['Long-term capital gains (equity)', i.ltcgEquity], ['Other capital gains', i.otherCapitalGains]] as [string, number][]).filter(([, v]) => v);
  const ded = ((f.recommendedRegime === 'old' ? [['80C', i.ded80C], ['80CCD(1B) NPS', i.ded80CCD1B], ['80D health', i.ded80D], ['24(b) home-loan interest', i.ded24b],
    ['80G donations', i.ded80G], ['80E education loan', i.ded80E], ['HRA exemption', i.hraExempt], ['Employer NPS 80CCD(2)', i.employerNps]] : [['Employer NPS 80CCD(2)', i.employerNps]]) as [string, number][]).filter(([, v]) => v);
  const refund = rec.refundOrPayable;
  const cf = f.carryForward || {};
  const hasCf = (cf.businessLoss || cf.housePropertyLoss || cf.stcl || cf.ltcl) > 0;
  const share = () => shareText(`paywatch-tax-computation-${f.fy}.txt`, [
    `PayWatch — Full Tax Computation (FY ${f.fy})`, `ITR form: ${f.form.code} (${f.form.name}) — ${f.form.why}`, `Recommended regime: ${String(f.recommendedRegime).toUpperCase()}`, '',
    'INCOME', ...income.map(([l, v]) => `  ${l}: ${R_(v)}`), `  Gross total income: ${R_(rec.grossTotalIncome)}`, '',
    'DEDUCTIONS', ...ded.map(([l, v]) => `  ${l}: ${R_(v)}`), `  Total deductions: ${R_(rec.deductions)}`, '',
    `Taxable income (slab): ${R_(rec.totalIncome)}`, `Tax on slab income: ${R_(rec.slabTax)}`, `Less 87A rebate: ${R_(rec.rebate)}`,
    `Capital-gains tax: ${R_(rec.capitalGainsTax)}`, `Surcharge: ${R_(rec.surcharge)}`, `Cess (4%): ${R_(rec.cess)}`, `TOTAL TAX: ${R_(rec.totalTax)}`, '',
    `Taxes already paid: ${R_(rec.taxesPaid)}`, `${refund >= 0 ? 'REFUND DUE' : 'TAX PAYABLE'}: ${R_(Math.abs(refund))}`, '',
    f.needsCA?.required ? `NOTE: ${f.needsCA.reason}` : '', 'Estimate for self-filing — cross-check against Form 26AS / AIS before filing.',
  ].join('\n')).catch(() => {});
  return (
    <View style={{ gap: 12, marginTop: SP.md }}>
      <Card tone="dark">
        <Txt noTr style={{ color: C.mint300, fontWeight: '700' }}>{`${f.form.code} · ${f.form.name}`}</Txt>
        <Small style={{ color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>{f.form.why}</Small>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
          <View><Tiny style={{ color: 'rgba(255,255,255,0.5)' }}>REGIME</Tiny><Txt noTr style={{ color: C.white, fontFamily: FONT.display, fontSize: 20, textTransform: 'capitalize' }}>{f.recommendedRegime}</Txt></View>
          <View><Tiny style={{ color: 'rgba(255,255,255,0.5)' }}>{refund >= 0 ? 'REFUND DUE' : 'TAX PAYABLE'}</Tiny><Num style={{ color: C.mint300, fontFamily: FONT.display, fontSize: 20 }}>{inr(Math.abs(refund))}</Num></View>
        </View>
      </Card>
      <Card>
        <Label style={{ marginBottom: 6 }}>Income</Label>
        {income.length ? income.map(([l, v]) => <Line key={l} k={l} v={inr(v)} />) : <Small>No income recorded yet — upload your payslip / Form 16 under Monthly records.</Small>}
        <Line k="Gross total income" v={inr(rec.grossTotalIncome)} bold />
        {ded.length > 0 && <><Label style={{ marginTop: 12, marginBottom: 6 }}>{`Deductions (${f.recommendedRegime} regime)`}</Label>
          {ded.map(([l, v]) => <Line key={l} k={l} v={`−${inr(v)}`} />)}<Line k="Total deductions" v={`−${inr(rec.deductions)}`} bold /></>}
      </Card>
      <Card>
        <Label style={{ marginBottom: 6 }}>{`Tax (${f.recommendedRegime} regime)`}</Label>
        <Line k="Taxable income (slab)" v={inr(rec.totalIncome)} /><Line k="Tax on slab income" v={inr(rec.slabTax)} />
        {rec.rebate > 0 && <Line k="Less: 87A rebate" v={`−${inr(rec.rebate)}`} color={C.green} />}
        {rec.capitalGainsTax > 0 && <Line k="Capital-gains tax" v={inr(rec.capitalGainsTax)} />}
        {rec.surcharge > 0 && <Line k="Surcharge" v={inr(rec.surcharge)} />}
        <Line k="Health & education cess" v={inr(rec.cess)} /><Line k="Total tax" v={inr(rec.totalTax)} bold />
        <Line k="Taxes paid (TDS + advance)" v={`−${inr(rec.taxesPaid)}`} />
        <View style={{ marginTop: 10, borderRadius: R.md, padding: 12, backgroundColor: refund >= 0 ? '#E2F3E5' : '#F8E3DF' }}>
          <Tiny>{refund >= 0 ? 'REFUND DUE' : 'TAX PAYABLE'}</Tiny>
          <Num style={{ fontFamily: FONT.display, fontSize: 24, color: refund >= 0 ? C.green : C.red }}>{inr(Math.abs(refund))}</Num>
        </View>
        <Tiny noTr style={{ marginTop: 6 }}>{`Other regime tax ${inr(other.totalTax)} · ${f.recommendedRegime} saves ${inr(Math.abs(other.totalTax - rec.totalTax))}.`}</Tiny>
      </Card>
      {(f.setOffNotes?.length > 0 || hasCf) && <Card>
        <Label style={{ marginBottom: 6 }}>Losses & set-off</Label>
        {f.setOffNotes?.length > 0 && <Bullets items={f.setOffNotes} />}
        {hasCf && <><Small style={{ marginTop: 8, fontWeight: '700' }}>Carried forward to next year:</Small>
          {cf.stcl > 0 && <Line k="Short-term capital loss" v={inr(cf.stcl)} />}{cf.ltcl > 0 && <Line k="Long-term capital loss" v={inr(cf.ltcl)} />}
          {cf.housePropertyLoss > 0 && <Line k="House-property loss" v={inr(cf.housePropertyLoss)} />}{cf.businessLoss > 0 && <Line k="Business loss" v={inr(cf.businessLoss)} />}</>}
      </Card>}
      {f.needsCA?.required && <Card style={{ borderLeftWidth: 4, borderLeftColor: C.amber }}><Small>{f.needsCA.reason}</Small></Card>}
      <Button title="Prepare & file my ITR" icon="arrow-forward" onPress={() => router.push('/tax/file')} />
      <Button kind="secondary" title="Share computation (for you or your CA)" icon="share-outline" onPress={share} />
    </View>
  );
}

function Copilot({ c }: { c: any }) {
  const ST: Record<string, { label: string; bg: string; fg: string }> = { due_soon: { label: 'Due now', bg: '#F8E3DF', fg: C.red }, upcoming: { label: 'Upcoming', bg: '#FBF0DF', fg: C.amber }, paid_window: { label: 'Later', bg: C.paper100, fg: C.inkSoft }, passed: { label: 'Passed', bg: '#E2F3E5', fg: C.green } };
  const p = c.readyPack;
  const share = () => shareText(`paywatch-tax-pack-${p.fy}.txt`, [
    `PayWatch — Tax Ready Pack (FY ${p.fy})`, '', `Recommended regime: ${String(p.recommendedRegime).toUpperCase()}`, `Gross income: ${R_(p.grossIncome)}`,
    `Total deductions: ${R_(p.totalDeductions)}`, `Taxable income: ${R_(p.taxableIncome)}`, `Estimated tax: ${R_(p.estimatedTax)} (${p.effectiveRatePct}% effective)`, '',
    'Deductions used:', ...p.deductionItems.map((d: any) => `  • ${d.section}: ${R_(d.used)} of ${R_(d.limit)}`), '', 'Documents to share with your CA:',
    ...p.documentsNeeded.map((d: string) => `  • ${d}`), '', 'Estimates for planning. Verify with your CA / the Income Tax portal before filing.',
  ].join('\n')).catch(() => {});
  return (
    <View style={{ gap: 12, marginTop: SP.md }}>
      <Card tone="mint"><Small>{c.season}</Small></Card>
      <Card>
        <Label>Advance tax</Label><Small style={{ marginTop: 4 }}>{c.advanceTax.reason}</Small>
        {c.advanceTax.applicable && c.advanceTax.instalments.map((x: any, i: number) => { const s = ST[x.status] || ST.upcoming; return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.paper100, marginTop: i ? 0 : 8 }}>
            <View style={{ flex: 1 }}><Txt noTr style={{ fontWeight: '700', fontSize: 14 }}>{x.label}</Txt><Tiny noTr>{`due ${prettyDate(x.dueDate)} · ${inr(x.cumulativeAmount)} (${x.cumulativePct}%)`}</Tiny></View>
            <Chip label={s.label} bg={s.bg} color={s.fg} />
          </View>
        ); })}
      </Card>
      <Card><Label>Proof collection calendar</Label>{c.proofChecklist.map((x: any, i: number) => <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 8 }}><Small style={{ flex: 1 }}>{x.item}</Small><Tiny>{x.when}</Tiny></View>)}</Card>
      <Card><Label>Capital-gains harvesting</Label><Num style={{ fontFamily: FONT.display, fontSize: 20, marginTop: 4 }}>{`${inr(c.harvesting.ltcgFreeLimit)} tax-free/yr`}</Num><Small style={{ marginTop: 4 }}>{c.harvesting.note}</Small></Card>
      <Card tone="dark">
        <Txt style={{ color: C.mint300, fontWeight: '700', fontSize: 12, letterSpacing: 1 }}>CA-READY PACK</Txt>
        <Small style={{ color: 'rgba(255,255,255,0.8)', marginTop: 6 }}>Your regime, income, deductions, estimated tax and document checklist — ready to hand to a CA.</Small>
        <Button kind="mint" small title="Share my tax pack" icon="share-outline" style={{ marginTop: 12, alignSelf: 'flex-start' }} onPress={share} />
      </Card>
    </View>
  );
}
