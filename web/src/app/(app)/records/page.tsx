'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { get, post, downloadFile } from '@/lib/api';
import { inr } from '@/lib/format';
import { fileToBase64 } from '@/components/CaThread';
import {
  readPdfText, parsePayslip, parseForm16, parseStatementFile, parseHoldingsFile, parseCapitalGainsCsv,
} from '@/lib/statementParse';

// ── The recurring documents we collect each month ───────────────────────────
// `formats` is enforced on upload so a blurry photo can't corrupt the numbers.
type DocType = {
  type: string; icon: string; label: string; sub: string;
  formats: string[]; cadence: string; salary?: 'monthly' | 'annual';
};
const DOC_TYPES: DocType[] = [
  { type: 'employment_contract', icon: '📜', label: 'Employment contract / offer letter', sub: 'Your appointment letter — role, joining date and the CTC you agreed.', formats: ['pdf'], cadence: 'Once' },
  { type: 'employment_letter', icon: '📃', label: 'Salary structure / breakup letter', sub: 'Your CTC broken into basic, HRA and allowances.', formats: ['pdf'], cadence: 'Once a year', salary: 'annual' },
  { type: 'payslip', icon: '🧾', label: 'Monthly payslip', sub: 'Including any reimbursements. We read it to project your tax.', formats: ['pdf'], cadence: 'Every month', salary: 'monthly' },
  { type: 'form16', icon: '📄', label: 'Form 16 (TDS certificate)', sub: 'Your employer’s year-end salary & tax certificate — the most authoritative.', formats: ['pdf'], cadence: 'Once a year', salary: 'annual' },
  { type: 'bank_statement', icon: '🏦', label: 'Bank statement', sub: 'We read every transaction to map your money flow.', formats: ['pdf', 'xlsx', 'xls', 'csv'], cadence: 'Every month' },
  { type: 'demat_holdings', icon: '📈', label: 'Demat / mutual-fund holdings', sub: 'A look-through of what you actually own and how diversified you are.', formats: ['xlsx', 'xls', 'csv'], cadence: 'Every month' },
  { type: 'capital_gains', icon: '💹', label: 'Capital-gains statement', sub: 'Realised short- and long-term gains from your broker P&L.', formats: ['xlsx', 'xls', 'csv'], cadence: 'Every month' },
  { type: 'form26as_ais', icon: '📊', label: 'Form 26AS / AIS', sub: 'The tax dept’s record of your income & TDS — to cross-check.', formats: ['pdf'], cadence: 'Each quarter' },
];

const FMT_NAME: Record<string, string> = { pdf: 'PDF', xlsx: 'Excel', xls: 'Excel', csv: 'CSV' };
function formatsLabel(f: string[]) {
  const names = Array.from(new Set(f.map((x) => FMT_NAME[x] || x.toUpperCase())));
  return names.length === 1 ? `${names[0]} only` : names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1];
}
const acceptFor = (f: string[]) => f.map((x) => '.' + x).join(',');

// month helpers
function lastMonths(n: number): { key: string; label: string }[] {
  const out = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ key, label: d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) });
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

interface Rec { record_id: string; period: string; doc_type: string; label: string; file_name: string | null; extracted: any; summary: string | null; has_file: boolean; created_at: string }

// A staged upload waiting for the user to confirm before it's saved.
interface Staged {
  dt: DocType; file: File; extracted: any; summary: string;
  annualGross?: number;      // paise — editable for salary docs
  applySalary?: { basicAnnual: number; hraAnnual: number };
  tax?: any;                 // /records/tax-preview result
  txns?: { date: string; description: string; amount: number; direction: 'debit' | 'credit' }[];
  form16?: any;              // parsed Form 16 figures (authoritative)
  note?: string;
  engine?: 'ai' | 'parser';  // who read it
  invalid?: boolean;         // AI says it isn't the expected document
  detected?: string;         // what the AI thinks it actually is
  aiReason?: string;         // why it doesn't match
  confidence?: number;       // 0..1
}

export default function MonthlyRecords() {
  const months = useMemo(() => lastMonths(6), []);
  const [period, setPeriod] = useState(months[0].key);
  const [records, setRecords] = useState<Rec[]>([]);
  const [staged, setStaged] = useState<Staged | null>(null);
  const [busy, setBusy] = useState('');      // doc type being parsed
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingType = useRef<DocType | null>(null);

  function load() { get('/records').then(setRecords).catch(() => {}); }
  useEffect(() => { load(); }, []);

  const forPeriod = (t: string) => records.filter((r) => r.period === period && r.doc_type === t);

  function pick(dt: DocType) { pendingType.current = dt; setErr(''); fileRef.current!.accept = acceptFor(dt.formats); fileRef.current?.click(); }

  async function onFile(file: File) {
    const dt = pendingType.current; if (!dt) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!dt.formats.includes(ext)) {
      setErr(`“${file.name}” isn’t a supported format. Please upload ${formatsLabel(dt.formats)} — a photo or scan can’t be read accurately and would risk wrong numbers.`);
      return;
    }
    setBusy(dt.type); setErr(''); setStaged(null);
    try { setStaged(await extract(dt, file)); }
    catch (e: any) { setErr(e?.message || 'Could not read that file. Try the format suggested under the card.'); }
    finally { setBusy(''); if (fileRef.current) fileRef.current.value = ''; }
  }

  // Document types we send to the AI reader (free-form / PDF docs where layout
  // varies and we also want to catch a wrong upload). Tabular CSV/Excel docs
  // (statement / holdings / capital gains) use the deterministic parsers.
  const AI_DOCS = ['form16', 'payslip', 'employment_letter', 'employment_contract', 'form26as_ais'];
  const RUPn = (n: any) => { const x = Number(n); return isFinite(x) && x > 0 ? Math.round(x * 100) : null; }; // rupees → paise
  const taxFor = (annualGross: number) => annualGross > 0 ? get(`/records/tax-preview?annualGross=${annualGross}`).catch(() => null) : Promise.resolve(null);

  // Per-type client-side extraction → a staged result for confirmation.
  async function extract(dt: DocType, file: File): Promise<Staged> {
    // ── AI-first path: Claude reads the text, identifies & validates it ──
    if (AI_DOCS.includes(dt.type)) {
      const text = await readPdfText(file).catch(() => '');
      let ai: any = null;
      if (text.trim().length > 20) ai = await post('/records/ai-extract', { doc_type: dt.type, text }).catch(() => null);
      if (ai?.available && ai.result) return fromAI(dt, file, ai.result);
      return fromParser(dt, file, text); // AI off or failed → deterministic
    }
    if (dt.type === 'bank_statement') {
      const r = await parseStatementFile(file);
      const debit = r.transactions.filter((t) => t.direction === 'debit').reduce((s, t) => s + t.amount, 0);
      const credit = r.transactions.filter((t) => t.direction === 'credit').reduce((s, t) => s + t.amount, 0);
      return { dt, file, txns: r.transactions, extracted: { count: r.transactions.length, debit, credit },
        summary: `${r.transactions.length} transactions · ${inr(credit)} in / ${inr(debit)} out`,
        note: r.warning };
    }
    if (dt.type === 'demat_holdings') {
      const { holdings, warning } = await parseHoldingsFile(file);
      if (!holdings.length) throw new Error(warning || 'No holdings found in that file.');
      const total = holdings.reduce((s, h) => s + h.value, 0);
      const xray = await post('/holdings/analyze', { holdings }).catch(() => null);
      return { dt, file, extracted: { count: holdings.length, total, grade: xray?.grade, byAssetClass: xray?.byAssetClass || [] },
        summary: `${holdings.length} holdings · ${inr(total)}${xray?.grade ? ` · diversification ${xray.grade}` : ''}` };
    }
    if (dt.type === 'capital_gains') {
      const { stcg, ltcg, rows } = await parseCapitalGainsCsv(file);
      return { dt, file, extracted: { stcg, ltcg, rows },
        summary: `${rows} trades · STCG ${inr(stcg)} · LTCG ${inr(ltcg)}` };
    }
    // form26as_ais and any other → just store the file for the CA.
    return { dt, file, extracted: {}, summary: 'Stored securely for you and your CA.' };
  }

  // Build a staged result from Claude's structured reading of the document.
  async function fromAI(dt: DocType, file: File, r: any): Promise<Staged> {
    const f = r.fields || {};
    const meta = {
      engine: 'ai' as const, invalid: !r.matchesExpected,
      detected: r.documentType, aiReason: r.reason, confidence: r.confidence,
    };
    if (dt.type === 'form16') {
      const form16 = {
        grossSalary: RUPn(f.grossSalaryAnnual), standardDeduction: RUPn(f.standardDeduction),
        chapter6A: RUPn(f.chapter6ADeductions), taxableIncome: RUPn(f.taxableIncome),
        taxOnIncome: RUPn(f.taxOnIncome), taxPayable: RUPn(f.taxPayable), tds: RUPn(f.tds),
      };
      const annualGross = form16.grossSalary || 0;
      const tax = await taxFor(annualGross);
      const summary = r.summary || (annualGross ? `Gross ${inr(annualGross)}/yr` : 'Form 16');
      return { dt, file, extracted: { ...form16, annualGross, ai: f }, summary, annualGross, tax, form16, ...meta };
    }
    if (dt.type === 'payslip' || dt.type === 'employment_letter') {
      const monthly = dt.salary === 'monthly';
      const grossUnit = monthly ? RUPn(f.grossMonthly) : RUPn(f.ctcAnnual);
      const netUnit = RUPn(f.netMonthly);
      const base = grossUnit ?? netUnit;
      const mult = monthly ? 12 : 1;
      const annualGross = base != null ? base * mult : 0;
      const basicUnit = RUPn(monthly ? f.basicMonthly : f.basicAnnual);
      const hraUnit = RUPn(monthly ? f.hraMonthly : f.hraAnnual);
      const applySalary = (basicUnit || hraUnit) ? { basicAnnual: (basicUnit || 0) * mult, hraAnnual: (hraUnit || 0) * mult } : undefined;
      const tax = await taxFor(annualGross);
      const tdsM = RUPn(f.tdsMonthly);
      const summary = r.summary || (annualGross ? `Gross ≈ ${inr(annualGross)}/yr${tdsM ? ` · TDS ${inr(tdsM)}/mo` : ''}` : 'Stored');
      return { dt, file, extracted: { ...f, annualGross }, summary, annualGross, applySalary, tax, ...meta };
    }
    // employment_contract, form26as_ais → informational; store with AI summary.
    return { dt, file, extracted: { ai: f }, summary: r.summary || 'Stored securely for you and your CA.', ...meta };
  }

  // Deterministic fallback (used when the AI reader is off or errors).
  async function fromParser(dt: DocType, file: File, text: string): Promise<Staged> {
    if (dt.type === 'form16') {
      const f = parseForm16(text);
      const annualGross = f.grossSalary || 0;
      const tax = await taxFor(annualGross);
      const summary = annualGross > 0
        ? `Gross ${inr(annualGross)}/yr${f.taxPayable ? ` · Form 16 tax ${inr(f.taxPayable)}` : ''}${f.tds ? ` · TDS ${inr(f.tds)}` : ''}`
        : 'Stored — we couldn’t read the figures; your CA can review the file.';
      return { dt, file, extracted: { ...f, annualGross }, summary, annualGross, tax, form16: f, engine: 'parser',
        note: annualGross === 0 ? 'We couldn’t read the salary — type the annual gross to project tax, or just keep the file for your CA.' : undefined };
    }
    if (dt.type === 'payslip' || dt.type === 'employment_letter') {
      const p = parsePayslip(text);
      const mult = dt.salary === 'monthly' ? 12 : 1;
      const annualGross = p.gross != null ? p.gross * mult : (p.net != null ? p.net * mult : 0);
      const applySalary = (p.basic || p.hra) ? { basicAnnual: (p.basic || 0) * mult, hraAnnual: (p.hra || 0) * mult } : undefined;
      const tax = await taxFor(annualGross);
      const tdsBit = p.tds ? ` · TDS ${inr(p.tds)}/mo` : '';
      const summary = annualGross > 0
        ? `Gross ≈ ${inr(annualGross)}/yr · est. tax ${tax ? inr(tax[tax.recommended].totalTax) : '—'}/yr${tdsBit}`
        : 'Stored — we couldn’t read the salary; enter it to project tax.';
      return { dt, file, extracted: { ...p, salaryBasis: dt.salary, annualGross }, summary, annualGross, applySalary, tax, engine: 'parser',
        note: p.gross == null ? 'We couldn’t confidently read the gross — please type it in so the tax projection is right.' : undefined };
    }
    // employment_contract / form26as_ais → just store.
    return { dt, file, extracted: {}, summary: 'Stored securely for you and your CA.', engine: 'parser' };
  }

  function setGross(v: string) {
    if (!staged) return;
    const paise = Math.round((parseFloat(v.replace(/[₹,\s]/g, '')) || 0) * 100);
    setStaged({ ...staged, annualGross: paise, extracted: { ...staged.extracted, annualGross: paise } });
  }
  async function recalcTax() {
    if (!staged?.annualGross) return;
    const tax = await get(`/records/tax-preview?annualGross=${staged.annualGross}`).catch(() => null);
    setStaged({ ...staged, tax, summary: `Gross ≈ ${inr(staged.annualGross)}/yr · est. tax ${tax ? inr(tax[tax.recommended].totalTax) : '—'}/yr` });
  }

  async function confirmSave() {
    if (!staged) return;
    setSaving(true); setErr('');
    try {
      const rec = await post('/records', {
        period, doc_type: staged.dt.type, label: staged.dt.label,
        extracted: staged.extracted, summary: staged.summary,
        applySalary: staged.applySalary,
      });
      const { data, mime } = await fileToBase64(staged.file);
      await post(`/records/${rec.record_id}/file`, { file_name: staged.file.name, mime_type: mime, data }).catch(() => {});
      // Bank statement → import the transactions (de-duplicated server-side).
      if (staged.dt.type === 'bank_statement' && staged.txns?.length) {
        await post('/statements/analyze', { transactions: staged.txns, persist: true }).catch(() => {});
      }
      setStaged(null); load();
    } catch (e: any) { setErr(e?.message || 'Could not save. Please try again.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />

      <div>
        <h1 className="font-display text-3xl font-medium">Monthly records</h1>
        <p className="text-sm text-ink-soft mt-1 max-w-2xl">Upload a few documents each month and PayWatch reads them with AI — understanding any format, pulling out the figures, and flagging if you’ve uploaded the wrong file. It builds the complete picture of your money and shares it neatly with your CA. Everything is encrypted.</p>
      </div>

      {/* Month picker */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        {months.map((m) => {
          const n = records.filter((r) => r.period === m.key).length;
          return (
            <button key={m.key} onClick={() => { setPeriod(m.key); setStaged(null); }}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold border transition-colors ${period === m.key ? 'bg-pine-900 text-white border-pine-900' : 'bg-white border-paper-200 text-ink-soft hover:border-pine-600'}`}>
              {m.label}{n > 0 && <span className={`ml-1.5 text-[10px] ${period === m.key ? 'text-mint-300' : 'text-pine-700'}`}>● {n}</span>}
            </button>
          );
        })}
      </div>

      {err && <div className="rounded-lg bg-signal-red/10 border border-signal-red/30 text-signal-red text-sm px-4 py-3">{err}</div>}

      {/* Staged upload — confirm before saving */}
      {staged && (
        <div className={`card p-5 border-2 space-y-3 ${staged.invalid ? 'border-signal-red/60 bg-signal-red/5' : 'border-mint-500/60 bg-mint-50'}`}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="font-bold text-sm">{staged.dt.icon} Review your {staged.dt.label.toLowerCase()}</p>
            <span className="flex items-center gap-2 text-[11px] text-ink-faint">
              {staged.engine === 'ai' && <span className="chip bg-pine-900 text-white text-[10px]">✨ Read by AI</span>}
              📎 {staged.file.name}
            </span>
          </div>

          {/* Wrong-document flag from the AI reader */}
          {staged.invalid && (
            <div className="rounded-lg bg-signal-red/10 border border-signal-red/40 px-3 py-2.5">
              <p className="text-sm font-bold text-signal-red">⚠ This doesn’t look like a {staged.dt.label.toLowerCase()}.</p>
              <p className="text-xs text-ink-soft mt-1">{staged.aiReason || (staged.detected && staged.detected !== 'other' ? `It looks more like a ${staged.detected.replace(/_/g, ' ')}.` : 'We couldn’t confirm it’s the right document.')} Please upload the correct file — or save it anyway if you’re sure.</p>
              <button onClick={() => pick(staged.dt)} className="mt-2 rounded-full bg-signal-red text-white px-4 py-1.5 text-xs font-bold">Choose a different file</button>
            </div>
          )}

          <p className="text-sm text-ink-soft">{staged.summary}</p>
          {staged.note && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">⚠ {staged.note}</p>}

          {/* Salary docs: editable annual gross + live tax window */}
          {(staged.dt.salary) && (
            <div className="space-y-3">
              <div className="flex items-end gap-2 flex-wrap">
                <div>
                  <label className="label">Annual gross salary (₹)</label>
                  <input className="input w-48" defaultValue={staged.annualGross ? Math.round(staged.annualGross / 100).toString() : ''} onChange={(e) => setGross(e.target.value)} onBlur={recalcTax} inputMode="numeric" />
                </div>
                <button onClick={recalcTax} className="rounded-full border border-pine-600 text-pine-700 px-4 py-2 text-xs font-bold hover:bg-pine-50">Recalculate tax</button>
              </div>
              {staged.tax && <TaxWindow tax={staged.tax} />}
              {staged.form16 && (
                <div className="rounded-xl bg-white border border-paper-200 p-4 text-sm">
                  <p className="font-bold mb-2">📄 Figures read from your Form 16</p>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-1">
                    {([['Gross salary', 'grossSalary'], ['Standard deduction', 'standardDeduction'], ['Taxable income', 'taxableIncome'], ['Tax on income', 'taxOnIncome'], ['Tax payable', 'taxPayable'], ['TDS deducted', 'tds']] as const).map(([lbl, key]) =>
                      staged.form16[key] != null ? (
                        <div key={key} className="flex justify-between"><dt className="text-ink-soft">{lbl}</dt><dd className="tabular-nums font-semibold">{inr(staged.form16[key])}</dd></div>
                      ) : null
                    )}
                  </dl>
                  <p className="text-[10px] text-ink-faint mt-2">Your employer’s final computed figures — the most authoritative for filing. The window above is our independent projection for comparison.</p>
                </div>
              )}
            </div>
          )}

          {/* Holdings preview */}
          {staged.dt.type === 'demat_holdings' && staged.extracted?.byAssetClass?.length > 0 && (
            <ul className="text-sm grid grid-cols-2 gap-x-6 gap-y-1">
              {staged.extracted.byAssetClass.slice(0, 6).map((a: any) => (
                <li key={a.key} className="flex justify-between"><span className="text-ink-soft">{a.label}</span><span className="tabular-nums">{a.pct}%</span></li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button onClick={confirmSave} disabled={saving}
              className={`disabled:opacity-50 ${staged.invalid ? 'rounded-full bg-ink-soft text-white px-5 py-2.5 text-sm font-bold' : 'btn-primary'}`}>
              {saving ? 'Saving…' : staged.invalid ? 'Save anyway' : 'Confirm & save'}</button>
            <button onClick={() => setStaged(null)} disabled={saving} className="text-sm text-ink-faint underline">Cancel</button>
          </div>
          <p className="text-[11px] text-ink-faint">🔒 The file is AES-256 encrypted before it’s stored. {staged.engine === 'ai' ? 'AI reads it to fill these in and checks it’s the right document — but you confirm before anything is saved.' : 'We never trust extracted numbers blindly — please check them above.'}</p>
        </div>
      )}

      {/* Doc cards for the selected month */}
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-2">{monthLabel(period)}</p>
        <div className="space-y-2">
          {DOC_TYPES.map((dt) => {
            const existing = forPeriod(dt.type);
            const has = existing.length > 0;
            return (
              <div key={dt.type} className={`rounded-xl border p-3 ${has ? 'border-mint-500/60 bg-mint-50' : 'border-paper-200 bg-white'}`}>
                <div className="flex items-center gap-3">
                  <span className={`grid place-items-center w-10 h-10 rounded-full text-lg shrink-0 ${has ? 'bg-mint-500 text-pine-950' : 'bg-paper-100'}`}>{has ? '✓' : dt.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold flex items-center gap-2 flex-wrap">{dt.label}
                      <span className="chip bg-paper-100 text-ink-faint text-[10px]">{dt.cadence}</span>
                      <span className="chip bg-paper-100 text-ink-faint text-[10px]">{formatsLabel(dt.formats)}</span>
                    </p>
                    <p className="text-[11px] text-ink-faint leading-snug mt-0.5">{has ? existing[0].summary : dt.sub}</p>
                  </div>
                  <button onClick={() => pick(dt)} disabled={busy === dt.type}
                    className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50 ${has ? 'border border-paper-200 text-pine-700 hover:border-pine-600' : 'bg-pine-900 text-white hover:bg-pine-800'}`}>
                    {busy === dt.type ? 'Reading…' : has ? 'Replace' : 'Upload'}
                  </button>
                </div>
                {has && (
                  <div className="mt-2 pl-12 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                    {existing.map((r) => (
                      <span key={r.record_id} className="inline-flex items-center gap-2">
                        {r.has_file && <button onClick={() => downloadFile(`/records/${r.record_id}/file`, r.file_name || 'document')} className="text-pine-700 underline">📎 {r.file_name}</button>}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-ink-faint">
        Connected a CA? They can see these records read-only under <Link href="/advisor" className="text-pine-700 underline">Your CA</Link>. PayWatch organises and prepares — your CA reviews and files.
      </p>
    </div>
  );
}

// Slab-by-slab tax window for both regimes (the "tax rate window").
function TaxWindow({ tax }: { tax: any }) {
  const [regime, setRegime] = useState<'old' | 'new'>(tax.recommended);
  const r = tax[regime];
  return (
    <div className="rounded-xl bg-white border border-paper-200 p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <p className="text-sm font-bold">Estimated tax liability</p>
        <div className="flex gap-1 text-xs">
          {(['old', 'new'] as const).map((rg) => (
            <button key={rg} onClick={() => setRegime(rg)} className={`px-3 py-1 rounded-full font-bold capitalize ${regime === rg ? 'bg-pine-900 text-white' : 'bg-paper-100 text-ink-soft'}`}>
              {rg}{tax.recommended === rg ? ' ✓' : ''}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center mb-3">
        <div><p className="text-[10px] uppercase tracking-wider text-ink-faint">Total tax/yr</p><p className="font-display text-lg font-semibold">{inr(r.totalTax)}</p></div>
        <div><p className="text-[10px] uppercase tracking-wider text-ink-faint">≈ TDS/mo</p><p className="font-display text-lg font-semibold">{inr(r.monthlyTds)}</p></div>
        <div><p className="text-[10px] uppercase tracking-wider text-ink-faint">Marginal rate</p><p className="font-display text-lg font-semibold">{r.marginalRatePct}%</p></div>
      </div>
      <table className="w-full text-xs">
        <thead><tr className="text-ink-faint text-left"><th className="font-medium py-1">Income slab</th><th className="font-medium text-center">Rate</th><th className="font-medium text-right">Tax on slab</th></tr></thead>
        <tbody>
          {r.bands.filter((b: any) => b.taxedAmount > 0).map((b: any, i: number) => (
            <tr key={i} className="border-t border-paper-100">
              <td className="py-1 tabular-nums">{inr(b.from)} – {b.to == null ? 'above' : inr(b.to)}</td>
              <td className="text-center tabular-nums">{Math.round(b.rate * 100)}%</td>
              <td className="text-right tabular-nums">{inr(b.tax)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-ink-faint mt-2">Taxable after ₹{Math.round(r.standardDeduction / 100).toLocaleString('en-IN')} standard deduction{r.rebate > 0 ? ' · 87A rebate applied (nil tax)' : ''}. {tax.disclaimer}</p>
    </div>
  );
}
