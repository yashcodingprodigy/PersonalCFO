// Monthly records — upload a few documents each month; PayWatch reads them (AI for free-form PDFs,
// structured parsers for statements/holdings/P&L), you confirm the figures, and your plan + tax update.
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useApi } from '@/lib/hooks';
import { ask, del, get, post } from '@/lib/api';
import { inr, rupeesToPaise, paiseToRupeesStr } from '@/lib/format';
import { pickFile, parseOnServer, openProtectedFile, Picked } from '@/lib/files';
import { CATEGORIES, DOC_TYPES, DocType } from '@/lib/recordTypes';
import { C, R, SP } from '@/lib/theme';
import { Bar, Button, Card, Chip, Disclaimer, Label, MoneyInput, Num, Screen, Segmented, Sheet, Small, Soft, Tiny, Txt, H3, Icon } from '@/components/ui';

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function lastMonths(n: number) {
  const out: { key: string; label: string }[] = []; const d = new Date();
  for (let i = 0; i < n; i++) { out.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}` }); d.setMonth(d.getMonth() - 1); }
  return out;
}
const AI_DOCS = ['form16', 'form16a', 'payslip', 'employment_letter', 'employment_contract', 'form26as_ais', 'mutual_fund_cas', 'dividend_statement', 'interest_certificate',
  'home_loan_certificate', 'other_loan_statement', 'rent_receipts', 'tax_saving_80c', 'health_insurance_80d', 'nps_statement', 'donation_80g', 'insurance_policy', 'property_papers', 'gst_returns', 'profit_loss'];
const RUPn = (n: any) => { const x = Number(n); return isFinite(x) && x > 0 ? Math.round(x * 100) : null; };
const MIME: Record<string, string[]> = {
  pdf: ['application/pdf'], csv: ['text/csv', 'text/comma-separated-values', 'text/plain'], xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], xls: ['application/vnd.ms-excel'],
};

interface Staged { dt: DocType; file: Picked; extracted: any; summary: string; annualGross?: number; applySalary?: any; tax?: any; txns?: any[]; note?: string; invalid?: boolean; unreadable?: boolean; detected?: string; reason?: string }

export default function Records() {
  const months = useMemo(() => lastMonths(6), []);
  const [period, setPeriod] = useState(months[0].key);
  const recs = useApi<any[]>('/records');
  const [busy, setBusy] = useState('');
  const [st, setSt] = useState<Staged | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [cat, setCat] = useState(CATEGORIES[0]);
  const records = recs.data || [];
  const forPeriod = (t: string) => records.filter((r: any) => r.period === period && r.doc_type === t);
  const uploaded = new Set(records.filter((r: any) => r.period === period).map((r: any) => r.doc_type)).size;
  const monthly = DOC_TYPES.filter((d) => d.cadence === 'Monthly').length;
  const taxFor = (g: number) => (g > 0 ? get(`/records/tax-preview?annualGross=${g}`).catch(() => null) : Promise.resolve(null));

  async function upload(dt: DocType) {
    setErr('');
    try {
      const f = await pickFile(dt.formats.flatMap((x) => MIME[x] || []));
      if (!f) return;
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      if (!dt.formats.includes(ext)) { setErr(`“${f.name}” isn’t a supported format for ${dt.label}. Please upload ${dt.formats.join(' / ').toUpperCase()} — a photo or scan can’t be read accurately.`); return; }
      setBusy(dt.type);
      setSt(await extract(dt, f));
    } catch (e: any) { setErr(e.message || 'Could not read that file.'); } finally { setBusy(''); }
  }

  async function extract(dt: DocType, file: Picked): Promise<Staged> {
    if (AI_DOCS.includes(dt.type)) {
      const { text, parsed } = await parseOnServer<{ text: string; parsed?: any }>(file, 'text', dt.type).catch(() => ({ text: '', parsed: undefined }) as any);
      const clean = (text || '').replace(/\s+/g, ' ').trim();
      if (clean.length < 60) return { dt, file, extracted: {}, invalid: true, unreadable: true, reason: 'This file has almost no readable text — it looks like a scan, a photo or a blurry PDF. Upload a clearer, text-based PDF.', summary: 'Couldn’t read this file clearly.' };
      const ai: any = await ask('/records/ai-extract', { doc_type: dt.type, text: clean }, 60000).catch(() => null);
      if (ai?.available && ai.result) return fromAI(dt, file, ai.result);
      // AI off → basic deterministic read for salary docs, otherwise store-only.
      if (parsed && (dt.type === 'form16')) {
        const g = parsed.grossSalary || 0; const tax = await taxFor(g);
        return { dt, file, extracted: { ...parsed, annualGross: g }, annualGross: g, tax, summary: g ? `Gross ${inr(g)}/yr` : 'Stored for your CA.', note: 'The AI reader is busy — basic read. Check the figures.' };
      }
      if (parsed && (dt.type === 'payslip' || dt.type === 'employment_letter')) {
        const mult = dt.salary === 'monthly' ? 12 : 1;
        const g = parsed.gross != null ? parsed.gross * mult : parsed.net != null ? parsed.net * mult : 0;
        const tax = await taxFor(g);
        return { dt, file, extracted: { ...parsed, salaryBasis: dt.salary, annualGross: g }, annualGross: g, tax,
          applySalary: (parsed.basic || parsed.hra) ? { basicAnnual: (parsed.basic || 0) * mult, hraAnnual: (parsed.hra || 0) * mult } : undefined,
          summary: g ? `Gross ≈ ${inr(g)}/yr` : 'Enter the salary to project tax.', note: 'The AI reader is busy — basic read. Please check the gross.' };
      }
      return { dt, file, extracted: {}, summary: 'Stored securely for you and your CA.', note: 'The AI reader is busy right now — the file is stored; re-upload later for a full read.' };
    }
    if (dt.type === 'bank_statement' || dt.type === 'credit_card_statement') {
      const r: any = await parseOnServer(file, 'statement');
      const tx = r.transactions || [];
      const debit = tx.filter((t: any) => t.direction === 'debit').reduce((s: number, t: any) => s + t.amount, 0);
      const credit = tx.filter((t: any) => t.direction === 'credit').reduce((s: number, t: any) => s + t.amount, 0);
      return { dt, file, txns: dt.type === 'bank_statement' ? tx : undefined, extracted: { count: tx.length, debit, credit }, summary: `${tx.length} transactions · ${inr(credit)} in / ${inr(debit)} out`, note: r.warning };
    }
    if (dt.type === 'demat_holdings') {
      const { holdings, warning }: any = await parseOnServer(file, 'holdings');
      if (!holdings?.length) throw new Error(warning || 'No holdings found in that file.');
      const total = holdings.reduce((s: number, h: any) => s + h.value, 0);
      const x: any = await ask('/holdings/analyze', { holdings }).catch(() => null);
      return { dt, file, extracted: { count: holdings.length, total, grade: x?.grade, byAssetClass: x?.byAssetClass || [] }, summary: `${holdings.length} holdings · ${inr(total)}${x?.grade ? ` · diversification ${x.grade}` : ''}` };
    }
    if (dt.type === 'capital_gains') {
      const { stcg, ltcg, rows }: any = await parseOnServer(file, 'capital_gains');
      return { dt, file, extracted: { stcg, ltcg, rows }, summary: `${rows} trades · STCG ${inr(stcg)} · LTCG ${inr(ltcg)}` };
    }
    return { dt, file, extracted: {}, summary: 'Stored securely for you and your CA.' };
  }

  async function fromAI(dt: DocType, file: Picked, r: any): Promise<Staged> {
    const f = r.fields || {}; const unreadable = r.readable === false;
    const meta = { invalid: !r.matchesExpected || unreadable, unreadable, detected: r.documentType, reason: r.reason };
    if (dt.type === 'form16') {
      const form16 = { grossSalary: RUPn(f.grossSalaryAnnual), standardDeduction: RUPn(f.standardDeduction), chapter6A: RUPn(f.chapter6ADeductions), taxableIncome: RUPn(f.taxableIncome), taxOnIncome: RUPn(f.taxOnIncome), taxPayable: RUPn(f.taxPayable), tds: RUPn(f.tds) };
      const g = form16.grossSalary || 0;
      return { dt, file, extracted: { ...form16, annualGross: g, ai: f }, annualGross: g, tax: await taxFor(g), summary: r.summary || (g ? `Gross ${inr(g)}/yr` : 'Form 16'), ...meta };
    }
    if (dt.type === 'payslip' || dt.type === 'employment_letter') {
      const monthly = dt.salary === 'monthly'; const mult = monthly ? 12 : 1;
      const base = (monthly ? RUPn(f.grossMonthly) : RUPn(f.ctcAnnual)) ?? RUPn(f.netMonthly);
      const g = base != null ? base * mult : 0;
      const b = RUPn(monthly ? f.basicMonthly : f.basicAnnual), h = RUPn(monthly ? f.hraMonthly : f.hraAnnual);
      return { dt, file, extracted: { ...f, annualGross: g }, annualGross: g, applySalary: (b || h) ? { basicAnnual: (b || 0) * mult, hraAnnual: (h || 0) * mult } : undefined,
        tax: await taxFor(g), summary: r.summary || (g ? `Gross ≈ ${inr(g)}/yr` : 'Stored'), ...meta };
    }
    return { dt, file, extracted: { ai: f, ...f }, summary: r.summary || 'Stored securely for you and your CA.', ...meta };
  }

  function taxData(s: Staged): Record<string, number> | undefined {
    const f = s.extracted || {}; const RUP = (n: any) => { const x = Number(n); return isFinite(x) && x > 0 ? Math.round(x * 100) : 0; };
    const td: Record<string, number> = {}; const t = s.dt.type;
    if (t === 'home_loan_certificate') { if (RUP(f.interestPaid)) td.home_loan_interest_annual = RUP(f.interestPaid); if (RUP(f.principalRepaid)) td.home_loan_principal_annual = RUP(f.principalRepaid); }
    if (t === 'health_insurance_80d' && RUP(f.premiumPaid)) td.health_premium_self_annual = RUP(f.premiumPaid);
    if (t === 'nps_statement' && RUP(f.employeeContribution)) td.nps_80ccd1b_annual = Math.min(RUP(f.employeeContribution), 5000000);
    if (t === 'donation_80g' && RUP(f.donationAmount)) td.donations_80g_annual = RUP(f.donationAmount);
    if (t === 'rent_receipts' && RUP(f.monthlyRent)) td.rent_paid_monthly = RUP(f.monthlyRent);
    if (t === 'capital_gains') { const s1 = Math.round(Number(f.stcg) || 0), l1 = Math.round(Number(f.ltcg) || 0); if (s1 > 0) td.stcg_equity = s1; else if (s1 < 0) td.stcl = -s1; if (l1 > 0) td.ltcg_equity = l1; else if (l1 < 0) td.ltcl = -l1; }
    if (t === 'interest_certificate') { if (RUP(f.totalInterest)) td.interest_income = RUP(f.totalInterest); if (RUP(f.tdsDeducted)) td.tds_other = RUP(f.tdsDeducted); }
    if (t === 'dividend_statement') { if (RUP(f.totalDividend)) td.dividend_income = RUP(f.totalDividend); if (RUP(f.tdsDeducted)) td.tds_other = RUP(f.tdsDeducted); }
    if (t === 'form16') { const ai = f.ai || {}; if (RUP(ai.grossSalaryAnnual)) td.salary_gross = RUP(ai.grossSalaryAnnual); if (RUP(ai.tds)) td.tds_salary = RUP(ai.tds); }
    if (t === 'form16a' && RUP(f.tdsDeducted)) td.tds_other = RUP(f.tdsDeducted);
    return Object.keys(td).length ? td : undefined;
  }

  async function save() {
    if (!st) return;
    setSaving(true); setErr('');
    try {
      let fps: string[] | undefined;
      if (st.dt.type === 'bank_statement' && st.txns?.length) { const r: any = await post('/statements/analyze', { transactions: st.txns, persist: true }).catch(() => null); fps = r?.fingerprints; }
      const rec: any = await post('/records', { period, doc_type: st.dt.type, label: st.dt.label, extracted: st.extracted, summary: st.summary, applySalary: st.applySalary, applyTaxData: taxData(st), importedFingerprints: fps });
      await post(`/records/${rec.record_id}/file`, { file_name: st.file.name, mime_type: st.file.mime, data: st.file.base64 }).catch(() => {});
      setSt(null);
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }
  const remove = (r: any) => Alert.alert(`Remove this ${String(r.label).toLowerCase()}?`,
    r.affects?.length ? `It fed data into your profile. Removing it will reverse and update: ${r.affects.join(', ')}.` : 'This only removes the stored file.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => del(`/records/${r.record_id}`).catch((e) => setErr(e.message)) }]);

  const regime = st?.tax ? st.tax[st.tax.recommended] : null;
  return (
    <View style={{ flex: 1 }}>
      <Screen onRefresh={recs.reload} refreshing={recs.refreshing}>
        <Soft>Upload a few documents each month. I read them, check you uploaded the right file, and update your plan and tax. Files are stored encrypted and visible to your CA if you connect one.</Soft>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: SP.lg, marginHorizontal: -SP.lg }} contentContainerStyle={{ paddingHorizontal: SP.lg, gap: 8 }}>
          {months.map((m) => { const n = records.filter((r: any) => r.period === m.key).length; const on = period === m.key; return (
            <Pressable key={m.key} onPress={() => setPeriod(m.key)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill, backgroundColor: on ? C.pine900 : C.white, borderWidth: 1, borderColor: on ? C.pine900 : C.paper200 }}>
              <Txt noTr style={{ fontSize: 13, fontWeight: '700', color: on ? C.white : C.inkSoft }}>{`${m.label}${n ? ` · ${n}` : ''}`}</Txt>
            </Pressable>); })}
        </ScrollView>
        <Card style={{ marginTop: SP.md }}>
          <Small noTr>{`${uploaded} of ${DOC_TYPES.length} uploaded for this month · ${Math.max(0, monthly - uploaded)} monthly ones to go`}</Small>
          <View style={{ marginTop: 8 }}><Bar value={uploaded / DOC_TYPES.length} /></View>
        </Card>
        {err ? <Card style={{ marginTop: 10, backgroundColor: '#F8E3DF' }}><Small style={{ color: C.red }}>{err}</Small></Card> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: SP.lg, marginHorizontal: -SP.lg }} contentContainerStyle={{ paddingHorizontal: SP.lg, gap: 8 }}>
          {CATEGORIES.map((c) => <Pressable key={c} onPress={() => setCat(c)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill, backgroundColor: cat === c ? C.mint100 : 'transparent', borderWidth: 1, borderColor: cat === c ? C.mint500 : C.paper200 }}>
            <Txt style={{ fontSize: 13, fontWeight: '600', color: cat === c ? C.pine800 : C.inkSoft }}>{c}</Txt></Pressable>)}
        </ScrollView>
        <View style={{ gap: 10, marginTop: SP.md }}>
          {DOC_TYPES.filter((d) => d.category === cat).map((dt) => {
            const mine = forPeriod(dt.type);
            return (
              <Card key={dt.type}>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  <Txt noTr style={{ fontSize: 24 }}>{dt.icon}</Txt>
                  <View style={{ flex: 1 }}>
                    <Txt style={{ fontWeight: '700' }}>{dt.label}</Txt>
                    <Small>{dt.sub}</Small>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}><Chip label={dt.cadence} bg={C.paper100} color={C.inkSoft} /><Chip noTr label={dt.formats.map((x) => x.toUpperCase()).join(' / ')} bg={C.paper100} color={C.inkSoft} /></View>
                  </View>
                  {mine.length > 0 && <Icon name="checkmark-circle" color={C.green} size={22} />}
                </View>
                {mine.map((r: any) => (
                  <View key={r.record_id} style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.paper100 }}>
                    {r.summary ? <Small noTr>{r.summary}</Small> : null}
                    <View style={{ flexDirection: 'row', gap: 14, marginTop: 6 }}>
                      {r.has_file && <Pressable onPress={() => openProtectedFile(`/records/${r.record_id}/file`, r.file_name || 'document').catch((e) => setErr(e.message))}><Txt style={{ color: C.pine700, fontWeight: '700', fontSize: 14 }}>Open file</Txt></Pressable>}
                      <Pressable onPress={() => upload(dt)}><Txt style={{ color: C.pine700, fontSize: 14 }}>Replace</Txt></Pressable>
                      <Pressable onPress={() => remove(r)}><Txt style={{ color: C.red, fontSize: 14 }}>Remove</Txt></Pressable>
                    </View>
                  </View>
                ))}
                {mine.length === 0 && <Button small kind="secondary" title={busy === dt.type ? 'Reading…' : 'Upload'} icon="cloud-upload-outline" loading={busy === dt.type} onPress={() => upload(dt)} style={{ marginTop: 10, alignSelf: 'flex-start' }} />}
              </Card>
            );
          })}
        </View>
        <Disclaimer>Figures are read automatically and always shown to you to confirm. Educational tax projections — verify before filing.</Disclaimer>
      </Screen>

      <Sheet visible={!!st} onClose={() => setSt(null)} title={st?.dt.label} full>
        {st && <>
          {st.invalid ? <Card style={{ backgroundColor: '#FBF0DF', marginBottom: SP.md }}><Txt style={{ fontWeight: '700', color: C.amber }}>{st.unreadable ? 'Hard to read' : 'This may be the wrong document'}</Txt><Small style={{ marginTop: 4 }}>{st.reason || `It looks like: ${st.detected || 'something else'}.`}</Small></Card> : null}
          <Card tone="mint"><Txt noTr style={{ fontWeight: '700' }}>{st.summary}</Txt>{st.note ? <Small style={{ marginTop: 4 }}>{st.note}</Small> : null}</Card>
          {st.dt.salary && <View style={{ marginTop: SP.lg }}>
            <MoneyInput label="Annual gross salary" value={paiseToRupeesStr(st.annualGross)} onChange={(v) => setSt({ ...st, annualGross: rupeesToPaise(v), extracted: { ...st.extracted, annualGross: rupeesToPaise(v) } })} />
            <Button small kind="secondary" title="Re-calculate tax" onPress={async () => { const tax = await taxFor(st.annualGross || 0); setSt({ ...st, tax }); }} />
          </View>}
          {regime && <Card style={{ marginTop: SP.md }}>
            <Label>{`Tax projection (${st.tax.recommended} regime)`}</Label>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <View style={{ flex: 1 }}><Tiny>Total tax / yr</Tiny><Num style={{ fontWeight: '700' }}>{inr(regime.totalTax)}</Num></View>
              <View style={{ flex: 1 }}><Tiny>≈ TDS / month</Tiny><Num style={{ fontWeight: '700' }}>{inr(regime.monthlyTds)}</Num></View>
              <View style={{ flex: 1 }}><Tiny>Marginal rate</Tiny><Num style={{ fontWeight: '700' }}>{`${regime.marginalRatePct}%`}</Num></View>
            </View>
            {(regime.bands || []).filter((b: any) => b.taxedAmount > 0).map((b: any, i: number) => <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}><Small noTr>{`${inr(b.from)} – ${b.to == null ? 'above' : inr(b.to)} @ ${Math.round(b.rate * 100)}%`}</Small><Num style={{ fontSize: 13 }}>{inr(b.tax)}</Num></View>)}
          </Card>}
          {st.dt.type === 'demat_holdings' && st.extracted?.byAssetClass?.length > 0 && <Card style={{ marginTop: SP.md }}>{st.extracted.byAssetClass.slice(0, 6).map((a: any) => <View key={a.key} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Small>{a.label}</Small><Num style={{ fontSize: 13 }}>{`${a.pct}%`}</Num></View>)}</Card>}
          <Button title={st.invalid ? 'Save anyway' : 'Looks right — save'} style={{ marginTop: SP.lg }} onPress={save} loading={saving} />
          <Button kind="ghost" title="Cancel" onPress={() => setSt(null)} />
          <Tiny style={{ marginTop: 6 }}>Saving updates your deductions, tax, score and plan. You can remove it later and everything it changed is reversed.</Tiny>
        </>}
      </Sheet>
    </View>
  );
}
