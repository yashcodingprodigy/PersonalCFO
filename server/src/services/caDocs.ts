// CA documents (D-71, Nov 2026): find the user's documents for anything a CA asks for, and build the one-click
// ITR pack. Sources are everything the user has already given PayWatch — Monthly records, the Document vault,
// uploaded insurance policies — plus documents PayWatch generates itself (the tax computation). When data
// tie-ups go live (AA, broker/CAS, AIS via ERI, DigiLocker, payroll), those fetched files land in the same
// stores, so this code does not change. Nothing here calls an AI or sends anything without the user's tap.
import crypto from 'crypto';
import { query } from '../db';
import { listRecords, getRecordFile } from './monthlyRecords';
import { getVaultFile } from './vault';
import { listPolicies, getPolicyFile } from './insurancePolicies';
import { loadProfileData } from './profile';
import { taxStory, TaxStory } from './taxStory';
import { inrIN } from '../lib/money';

export interface DocSource { key: string; label: string; records?: string[]; vault?: string[]; policies?: boolean; generated?: 'computation'; monthly?: boolean }

// Everything a CA can request. Keys 1–11 match ITR_DOCUMENTS (itr.ts) so the shared checklist stays in sync.
export const DOC_SOURCES: DocSource[] = [
  { key: 'tax_computation', label: 'Tax computation (prepared by PayWatch)', generated: 'computation' },
  { key: 'form16', label: 'Form 16', records: ['form16'], vault: ['form16'] },
  { key: 'form26as_ais', label: 'Form 26AS & AIS', records: ['form26as_ais'], vault: ['form26as_ais'] },
  { key: 'payslips', label: 'Payslips', records: ['payslip'], vault: ['salary_slips'], monthly: true },
  { key: 'bank_interest', label: 'Bank / FD interest certificate', records: ['interest_certificate'] },
  { key: 'bank_statements', label: 'Bank statements', records: ['bank_statement'], vault: ['bank_statement'], monthly: true },
  { key: 'capital_gains', label: 'Capital-gains statement', records: ['capital_gains', 'mutual_fund_cas', 'demat_holdings'], vault: ['capital_gains', 'demat_holdings'] },
  { key: 'deduction_proofs', label: '80C / 80D / NPS / 80G proofs', records: ['tax_saving_80c', 'health_insurance_80d', 'nps_statement', 'donation_80g'], vault: ['investment_proofs'] },
  { key: 'home_loan', label: 'Home-loan interest certificate', records: ['home_loan_certificate'], vault: ['loan_certificate'] },
  { key: 'rent_hra', label: 'Rent receipts + landlord PAN', records: ['rent_receipts'], vault: ['rent_receipts'], monthly: true },
  { key: 'other_income', label: 'Other income proofs (dividends, Form 16A)', records: ['dividend_statement', 'form16a'] },
  { key: 'insurance_policies', label: 'Insurance policies', policies: true, vault: ['insurance_policy'] },
  { key: 'pan', label: 'PAN card', vault: ['pan'] },
  { key: 'aadhaar', label: 'Aadhaar', vault: ['aadhaar'] },
  { key: 'property_papers', label: 'Property papers', records: ['property_papers'], vault: ['property_papers'] },
  { key: 'business_books', label: 'GST returns / P&L', records: ['gst_returns', 'profit_loss'] },
];
export const sourceFor = (key: string) => DOC_SOURCES.find((s) => s.key === key);
/** Keys for the full ITR pack (everything a CA normally needs to file). */
export const ITR_PACK_KEYS = ['tax_computation', 'form16', 'form26as_ais', 'payslips', 'bank_interest', 'capital_gains', 'deduction_proofs', 'home_loan', 'rent_hra', 'other_income', 'insurance_policies', 'pan', 'aadhaar', 'business_books'];

export interface GatheredFile { name: string; mimeType: string; buffer: Buffer }

// ── The generated tax computation (printable HTML; opens in any browser, "Save as PDF" works) ──
const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
export function computationHtml(story: TaxStory, userName = ''): string {
  const f = story.ca, rec = f.recommendedRegime === 'old' ? f.old : f.new, i = f.inputs, R = inrIN;
  const row = (l: string, v: number, strong = false) => `<tr${strong ? ' class="s"' : ''}><td>${esc(l)}</td><td class="n">${R(v)}</td></tr>`;
  const incomes: [string, number][] = ([['Salary (gross)', i.grossSalary], ['Interest income', i.interestIncome], ['House property (net)', i.housePropertyIncome],
    ['Other income (dividends etc.)', i.otherIncome], ['Business / profession', i.businessIncome], ['STCG — equity (111A)', i.stcgEquity],
    ['LTCG — equity (112A)', i.ltcgEquity], ['Other capital gains', i.otherCapitalGains + (i.stcgOther || 0) + (i.ltcgOther || 0)]] as [string, number][]).filter(([, v]) => v);
  const deds: [string, number][] = ([['80C', i.ded80C], ['80CCD(1B) NPS', i.ded80CCD1B], ['80D health insurance', i.ded80D], ['24(b) home-loan interest', i.ded24b],
    ['80G donations', i.ded80G], ['80TTA', i.ded80TTA], ['80E education loan', i.ded80E], ['HRA exemption', i.hraExempt], ['80CCD(2) employer NPS', i.employerNps]] as [string, number][]).filter(([, v]) => v);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Tax computation FY ${esc(f.fy)}</title><style>
body{font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#1d2a26;max-width:760px;margin:32px auto;padding:0 20px}
h1{font-size:22px;margin:0}h2{font-size:15px;margin:22px 0 6px;text-transform:uppercase;letter-spacing:.06em;color:#4a5a55}
table{width:100%;border-collapse:collapse}td{padding:5px 0;border-bottom:1px solid #eee}.n{text-align:right;font-variant-numeric:tabular-nums}
.s td{font-weight:700;border-top:1px solid #999}.box{background:#f2f7f4;border-radius:10px;padding:12px 16px;margin:14px 0}.muted{color:#6b7a75;font-size:12px}
</style></head><body>
<h1>Income-tax computation — FY ${esc(f.fy)} (AY ${esc(story.ay)})</h1>
<p class="muted">${userName ? esc(userName) + ' · ' : ''}Prepared by PayWatch on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · ${esc(f.form.code)} (${esc(f.form.name)}) · ${esc(f.recommendedRegime)} regime recommended</p>
<div class="box">${esc(story.headline.sentence)}<br>${esc(story.regimeCompare.sentence)}</div>
<h2>Income</h2><table>${incomes.map(([l, v]) => row(l, v)).join('')}${row('Gross total income', rec.grossTotalIncome, true)}</table>
<h2>Deductions & exemptions (${esc(f.recommendedRegime)} regime)</h2><table>${(f.recommendedRegime === 'old' ? deds : deds.filter(([l]) => l.startsWith('80CCD(2)'))).map(([l, v]) => row(l, v)).join('') || '<tr><td>None claimed</td><td></td></tr>'}${row('Total deductions', rec.deductions, true)}</table>
<h2>Tax</h2><table>${row('Taxable income (slab)', rec.totalIncome)}${row('Tax on slab income', rec.slabTax)}${rec.rebate ? row('Less: rebate u/s 87A', -rec.rebate) : ''}${rec.capitalGainsTax ? row('Capital-gains tax (special rates)', rec.capitalGainsTax) : ''}${rec.surcharge ? row('Surcharge', rec.surcharge) : ''}${row('Health & education cess (4%)', rec.cess)}${row('Total tax', rec.totalTax, true)}${row('Taxes paid (TDS + advance tax)', rec.taxesPaid)}${row(rec.refundOrPayable >= 0 ? 'Refund due' : 'Tax payable', Math.abs(rec.refundOrPayable), true)}</table>
<h2>Old vs new regime</h2><table>${row('Old regime — total tax', f.old.totalTax)}${row('New regime — total tax', f.new.totalTax)}</table>
${f.setOffNotes.length ? `<h2>Set-off notes</h2><ul>${f.setOffNotes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
${(f.carryForward.stcl + f.carryForward.ltcl + f.carryForward.housePropertyLoss + f.carryForward.businessLoss) > 0 ? `<h2>Losses carried forward</h2><table>${f.carryForward.stcl ? row('Short-term capital loss', f.carryForward.stcl) : ''}${f.carryForward.ltcl ? row('Long-term capital loss', f.carryForward.ltcl) : ''}${f.carryForward.housePropertyLoss ? row('House-property loss', f.carryForward.housePropertyLoss) : ''}${f.carryForward.businessLoss ? row('Business loss', f.carryForward.businessLoss) : ''}</table>` : ''}
<p class="muted">Data confidence: ${esc(story.confidence.sentence)}</p>
<p class="muted">${esc(f.disclaimer)}</p></body></html>`;
}

/** Collects the user's files for one requested key (latest first; monthly types up to 12, others up to 3). */
export async function gatherFiles(userId: string, key: string, ctx?: { story?: TaxStory; userName?: string }): Promise<GatheredFile[]> {
  const src = sourceFor(key);
  if (!src) return [];
  const out: GatheredFile[] = [];
  if (src.generated === 'computation') {
    const p = await loadProfileData(userId);
    if (p) {
      const st = ctx?.story || taxStory(p, (await listRecords(userId)).map((r) => r.doc_type));
      out.push({ name: `Tax-computation-FY${st.fy}.html`, mimeType: 'text/html', buffer: Buffer.from(computationHtml(st, ctx?.userName), 'utf8') });
    }
    return out;
  }
  const cap = src.monthly ? 12 : 3;
  if (src.records?.length) {
    const recs = (await listRecords(userId)).filter((r) => src.records!.includes(r.doc_type) && r.has_file)
      .sort((a, b) => (b.period || '').localeCompare(a.period || '') || String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, cap);
    for (const r of recs) {
      const f = await getRecordFile(userId, r.record_id).catch(() => null);
      if (f) out.push({ name: `${r.period}-${f.fileName}`, mimeType: f.mimeType, buffer: f.buffer });
    }
  }
  if (src.vault?.length && out.length < cap) {
    const rows = await query<{ id: string }>(
      `SELECT id FROM documents WHERE user_id = $1 AND storage_path IS NOT NULL AND slot = ANY($2) ORDER BY updated_at DESC LIMIT $3`,
      [userId, src.vault, cap - out.length]);
    for (const r of rows) {
      const f = await getVaultFile(userId, r.id).catch(() => null);
      if (f) out.push({ name: f.fileName, mimeType: f.mimeType, buffer: f.buffer });
    }
  }
  if (src.policies && out.length < cap) {
    const pols = (await listPolicies(userId) as any[]).filter((p) => p.has_file !== false).slice(0, cap - out.length);
    for (const p of pols) {
      const f = await getPolicyFile(userId, p.policy_id).catch(() => null);
      if (f) out.push({ name: f.fileName, mimeType: f.mimeType, buffer: f.buffer });
    }
  }
  return out;
}

// ── Minimal ZIP writer (stored, no compression) — no dependency, works with every unzip tool ──
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(buf: Buffer): number { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
export function makeZip(entries: { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [], central: Buffer[] = [];
  let offset = 0;
  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)) & 0xffff;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;
  const seen = new Set<string>();
  for (const e of entries) {
    let name = e.name.replace(/[\\:*?"<>|]/g, '_').slice(0, 180);
    for (let k = 2; seen.has(name); k++) name = name.replace(/(\.[^./]+)?$/, ` (${k})$1`);
    seen.add(name);
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(e.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime, 10); local.writeUInt16LE(dosDate, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(e.data.length, 18); local.writeUInt32LE(e.data.length, 22); local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    parts.push(local, nameBuf, e.data);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(0, 10);
    cen.writeUInt16LE(dosTime, 12); cen.writeUInt16LE(dosDate, 14); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(e.data.length, 20);
    cen.writeUInt32LE(e.data.length, 24); cen.writeUInt16LE(nameBuf.length, 28); cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += local.length + nameBuf.length + e.data.length;
  }
  const cenBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cenBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cenBuf, end]);
}

export interface ItrPack { fileName: string; zip: Buffer; included: { key: string; label: string; files: number }[]; missing: string[]; fy: string }

/** One zip with every document a CA needs to file, in numbered folders, plus a README of what's in and what's missing. */
export async function buildItrPack(userId: string, userName = ''): Promise<ItrPack> {
  const p = await loadProfileData(userId);
  const docTypes = (await listRecords(userId)).map((r) => r.doc_type);
  const story = p ? taxStory(p, docTypes) : undefined;
  const entries: { name: string; data: Buffer }[] = [];
  const included: ItrPack['included'] = [], missing: string[] = [];
  let n = 1;
  for (const key of ITR_PACK_KEYS) {
    const src = sourceFor(key)!;
    const files = await gatherFiles(userId, key, { story, userName });
    if (files.length) {
      const folder = `${String(n).padStart(2, '0')} ${src.label.replace(/[\/]/g, '-')}`;
      for (const f of files) entries.push({ name: `${folder}/${f.name}`, data: f.buffer });
      included.push({ key, label: src.label, files: files.length });
      n++;
    } else if (key !== 'business_books') missing.push(src.label);
  }
  const fy = story?.fy || '';
  const readme = [
    `ITR document pack — FY ${fy}${userName ? ` — ${userName}` : ''}`,
    `Prepared by PayWatch on ${new Date().toLocaleString('en-IN')}`, '',
    'Included:', ...included.map((x) => `  ✓ ${x.label} (${x.files} file${x.files > 1 ? 's' : ''})`), '',
    missing.length ? 'Not available in PayWatch yet (ask the client):' : 'Nothing missing.', ...missing.map((m) => `  • ${m}`), '',
    story ? `Summary: ${story.headline.sentence}` : '',
    'Open "01 Tax computation" in any browser; use Print → Save as PDF if you need a PDF.',
  ].join('\n');
  entries.unshift({ name: '00 README.txt', data: Buffer.from(readme, 'utf8') });
  const id = crypto.randomBytes(3).toString('hex');
  return { fileName: `ITR-pack-FY${fy || 'current'}-${id}.zip`, zip: makeZip(entries), included, missing, fy };
}

/** Pure: does this chat/voice message ask PayWatch to send documents to the user's CA? (EN / Hinglish / Hindi) */
export function detectCaIntent(text: string): 'send_pack' | 'send_requested' | null {
  const t = (text || '').toLowerCase();
  const toCa = /\b(ca|c\.a\.|chartered accountant|accountant|tax consultant)\b|सीए|सी\.ए\./i.test(t);
  const send = /\b(send|share|forward|give|upload|mail|bhej|bhejo|bhej do|de do|dedo|pahuncha)\b|भेज|दे दो|शेयर/i.test(t);
  if (!toCa || !send) return null;
  const pack = /\b(itr|everything|all (?:my |the )?(?:docs|documents|papers)|full pack|whole pack|zip|filing (?:docs|documents|pack)|sab|saare|sare)\b|सब|सारे|पूरा/i.test(t);
  const requested = /\b(asked|request\w*|wants?|needs?|maang\w*|mang\w*|chahiye)\b|मांग|माँग|चाहिए/i.test(t);
  if (pack && !requested) return 'send_pack';
  return requested ? 'send_requested' : 'send_pack';
}
