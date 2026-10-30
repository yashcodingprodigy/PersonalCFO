// Server-side file parsing for the native apps (and any client that can't parse
// files locally): bank statements (CSV / Excel / PDF) → transactions, and any PDF →
// plain text for the AI document reader. Same heuristics as the web parser
// (web/src/lib/statementParse.ts) so both platforms read files identically.
// Heavy libraries load lazily and only when that file type is used.

export interface ParsedTxn { date: string; description: string; amount: number; direction: 'debit' | 'credit' }
export interface ParseResult { transactions: ParsedTxn[]; rowsSeen: number; warning?: string }

// ── helpers ──────────────────────────────────────────────────────────
const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

export function parseDate(raw: string): string {
  if (!raw) return '';
  const s = String(raw).trim();
  // YYYY-MM-DD or YYYY/MM/DD
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  // DD-MM-YYYY or DD/MM/YYYY  (Indian default — day first)
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = (Number(y) > 50 ? '19' : '20') + y;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // DD-MMM-YYYY  e.g. 05-Jan-2025 / 5 Jan 25
  m = s.match(/^(\d{1,2})[-\s]?([A-Za-z]{3})[A-Za-z]*[-\s]?(\d{2,4})/);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo) { let y = m[3]; if (y.length === 2) y = '20' + y; return `${y}-${mo}-${m[1].padStart(2, '0')}`; }
  }
  return '';
}

export function parseMoney(raw: any): number {
  if (raw == null) return 0;
  const s = String(raw).replace(/[₹\s]/g, '').replace(/,/g, '');
  const num = parseFloat(s.replace(/[^0-9.\-]/g, ''));
  return isNaN(num) ? 0 : Math.round(Math.abs(num) * 100);
}

const norm = (s: any) => String(s ?? '').toLowerCase().trim();
const looksLikeDateCol = (h: string) => /date|txn date|value date|posting/i.test(h);
const looksLikeDesc = (h: string) => /desc|narration|particular|details|remarks|transaction|memo/i.test(h);
const looksLikeDebit = (h: string) => /debit|withdraw|dr\b|paid out|outflow/i.test(h);
const looksLikeCredit = (h: string) => /credit|deposit|cr\b|paid in|inflow/i.test(h);
const looksLikeAmount = (h: string) => /amount|amt|value/i.test(h);
const looksLikeType = (h: string) => /type|dr\/cr|cr\/dr|indicator/i.test(h);

// Map an array of row-objects (from CSV/XLSX with a header row) to txns.
function mapObjectRows(rows: Record<string, any>[]): ParsedTxn[] {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);
  const find = (pred: (h: string) => boolean) => headers.find((h) => pred(h));
  const dateH = find(looksLikeDateCol) || headers[0];
  const descH = find(looksLikeDesc) || headers[1];
  const debitH = find(looksLikeDebit);
  const creditH = find(looksLikeCredit);
  const amountH = find(looksLikeAmount);
  const typeH = find(looksLikeType);

  const out: ParsedTxn[] = [];
  for (const r of rows) {
    const date = parseDate(r[dateH]);
    if (!date) continue;
    const description = String(r[descH] ?? '').trim() || 'Transaction';
    let amount = 0; let direction: 'debit' | 'credit' = 'debit';
    if (debitH || creditH) {
      const dv = debitH ? parseMoney(r[debitH]) : 0;
      const cv = creditH ? parseMoney(r[creditH]) : 0;
      if (cv > dv) { amount = cv; direction = 'credit'; } else { amount = dv; direction = 'debit'; }
    } else if (amountH) {
      amount = parseMoney(r[amountH]);
      const t = norm(typeH ? r[typeH] : r[amountH]);
      direction = /cr|credit|deposit/.test(t) ? 'credit' : 'debit';
      // signed amount (negative = debit)
      if (String(r[amountH]).trim().startsWith('-')) direction = 'debit';
    }
    if (amount > 0) out.push({ date, description, amount, direction });
  }
  return out;
}

// Reconstruct lines from a PDF page's text items, grouped by y-position.
function lineFromItems(items: any[]): string[] {
  const rows = new Map<number, { x: number; str: string }[]>();
  for (const it of items) {
    const y = Math.round(it.transform[5]);
    const arr = rows.get(y) || [];
    arr.push({ x: it.transform[4], str: it.str });
    rows.set(y, arr);
  }
  return Array.from(rows.entries())
    .sort((a: [number, any[]], b: [number, any[]]) => b[0] - a[0]) // top to bottom
    .map(([, arr]: [number, { x: number; str: string }[]]) =>
      arr.sort((a, b) => a.x - b.x).map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

// Parse reconstructed PDF lines into txns using a running-balance heuristic.
function parsePdfLines(lines: string[]): ParsedTxn[] {
  const out: ParsedTxn[] = [];
  let prevBalance: number | null = null;
  const moneyRe = /-?\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|-?\d+\.\d{2}/g; // require grouping or 2 decimals
  for (const line of lines) {
    const dateMatch = line.match(/^\s*(\d{1,2}[-/][A-Za-z0-9]{2,3}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/);
    if (!dateMatch) continue;
    const date = parseDate(dateMatch[1]);
    if (!date) continue;
    const rest = line.slice(dateMatch[0].length);
    const monies = rest.match(moneyRe);
    if (!monies || monies.length === 0) continue;
    const nums = monies.map((m) => Math.round(Math.abs(parseFloat(m.replace(/,/g, ''))) * 100));
    // last number is usually the running balance; the one before it the amount
    const balance = nums[nums.length - 1];
    const amount = nums.length >= 2 ? nums[nums.length - 2] : nums[0];
    const description = rest.replace(moneyRe, '').replace(/\s+/g, ' ').trim() || 'Transaction';
    let direction: 'debit' | 'credit';
    if (/\bcr\b|credit|deposit|salary|neft.*cr/i.test(line)) direction = 'credit';
    else if (/\bdr\b|debit|withdraw/i.test(line)) direction = 'debit';
    else if (prevBalance != null && nums.length >= 2) direction = balance >= prevBalance ? 'credit' : 'debit';
    else direction = 'debit';
    if (nums.length >= 2) prevBalance = balance;
    if (amount > 0) out.push({ date, description, amount, direction });
  }
  return out;
}


function mapArrayRows(aoa: any[][]): ParsedTxn[] {
  if (!aoa.length) return [];
  // find the row that looks like a header (contains 'date' and a desc/amount word)
  let headerIdx = aoa.findIndex((r) => r.some((c) => looksLikeDateCol(norm(c))) && r.some((c) => looksLikeDesc(norm(c)) || looksLikeAmount(norm(c)) || looksLikeDebit(norm(c)) || looksLikeCredit(norm(c))));
  if (headerIdx === -1) {
    // No header — synthesise objects with positional guesses: [date, desc, ...amounts]
    const out: ParsedTxn[] = [];
    let prevBal: number | null = null;
    for (const r of aoa) {
      const date = parseDate(r[0]);
      if (!date) continue;
      const desc = String(r[1] ?? 'Transaction').trim();
      const nums = r.slice(2).map(parseMoney).filter((x: number) => x > 0);
      if (!nums.length) continue;
      const amount = nums[0];
      const bal = nums.length >= 2 ? nums[nums.length - 1] : null;
      let dir: 'debit' | 'credit' = /cr|credit|deposit|salary/i.test(r.join(' ')) ? 'credit' : 'debit';
      if (bal != null && prevBal != null) dir = bal >= prevBal ? 'credit' : 'debit';
      if (bal != null) prevBal = bal;
      out.push({ date, description: desc, amount, direction: dir });
    }
    return out;
  }
  const headers = aoa[headerIdx].map((c) => String(c));
  const objs = aoa.slice(headerIdx + 1).map((r) => {
    const o: Record<string, any> = {};
    headers.forEach((h, i) => { o[h || `col${i}`] = r[i]; });
    return o;
  });
  return mapObjectRows(objs);
}

export interface HoldingRow { name: string; value: number; units?: number; type?: string }

function rowsToHoldings(rows: any[]): HoldingRow[] {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]);
  const findCol = (re: RegExp) => keys.find((h) => re.test(String(h).toLowerCase()));
  const num = (v: any) => { const n = parseFloat(String(v ?? '').replace(/[₹,\s]/g, '')); return isNaN(n) ? 0 : n; };
  const nameCol = findCol(/instrument|scheme|security|company|particular|stock name|fund name|^name$|holding|scrip|symbol|description/) || keys[0];
  const valueCol = findCol(/current value|market value|mkt.*val|cur.*val|present value|valuation|closing value|holding value|amount|^value$/);
  const qtyCol = findCol(/qty|quantity|units|shares|balance/);
  const priceCol = findCol(/ltp|last price|closing price|nav|current price|market price|rate/);
  const typeCol = findCol(/asset type|instrument type|^type$|category|asset class|product/);

  const out: HoldingRow[] = [];
  for (const r of rows) {
    const name = String(r[nameCol] ?? '').trim();
    if (!name || /^total|grand total|sub.?total/i.test(name)) continue;
    let value = valueCol ? num(r[valueCol]) : 0;
    const units = qtyCol ? num(r[qtyCol]) : undefined;
    if (!value && qtyCol && priceCol) value = num(r[qtyCol]) * num(r[priceCol]);
    if (value <= 0) continue;
    out.push({ name, value: Math.round(value * 100), units, type: typeCol ? String(r[typeCol] ?? '').trim() : undefined });
  }
  return out;
}


// ── tiny RFC-4180 CSV reader (quotes, commas, CRLF) ──────────────────
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((x) => x.trim())) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell); if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

// Lazy, untyped loaders — keeps these big libraries out of the type graph and the cold start.
// `new Function` keeps a real ESM import() after CommonJS compilation (pdf.js ships ESM only).
const esmImport = new Function('s', 'return import(s)') as (s: string) => Promise<any>;
async function loadPdfjs(): Promise<any> { return esmImport('pdfjs-dist/legacy/build/pdf.mjs'); }
async function loadXlsx(): Promise<any> { const m: any = await esmImport('xlsx'); return m.default || m; }

async function pdfPages(buf: Buffer): Promise<any[]> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useWorkerFetch: false, isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise;
  const pages: any[] = [];
  for (let i = 1; i <= doc.numPages; i++) pages.push(await (await doc.getPage(i)).getTextContent());
  return pages;
}

/** Plain text from a PDF (for the AI document reader). Empty string if unreadable (e.g. a scan). */
export async function pdfText(buf: Buffer): Promise<string> {
  const pages = await pdfPages(buf);
  return pages.map((c) => c.items.map((it: any) => it.str).join(' ')).join(' ').replace(/\s+/g, ' ').trim();
}

/** Bank statement file → transactions. */
export async function parseStatementBuffer(name: string, buf: Buffer): Promise<ParseResult> {
  const n = name.toLowerCase();
  if (n.endsWith('.csv') || n.endsWith('.txt')) {
    const aoa = parseCsv(buf.toString('utf8'));
    let txns = mapObjectRows(aoaToObjects(aoa));
    if (!txns.length) txns = mapArrayRows(aoa.filter((r) => r.length >= 3));
    return { transactions: txns, rowsSeen: aoa.length, warning: txns.length ? undefined : 'No transactions could be read from this CSV. Check that it has Date, Description and amount columns.' };
  }
  if (n.endsWith('.xlsx') || n.endsWith('.xls')) {
    const XLSX = await loadXlsx();
    const wb = XLSX.read(buf, { type: 'buffer' });
    const aoa: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
    const txns = mapArrayRows(aoa);
    return { transactions: txns, rowsSeen: aoa.length, warning: txns.length ? undefined : 'No transactions could be read from this spreadsheet.' };
  }
  if (n.endsWith('.pdf')) {
    const pages = await pdfPages(buf);
    const lines = pages.flatMap((c) => lineFromItems(c.items));
    const txns = parsePdfLines(lines);
    return {
      transactions: txns, rowsSeen: lines.length,
      warning: txns.length ? 'PDF reading is best-effort — please sanity-check the totals against your statement.'
        : 'We couldn’t read transactions from this PDF — layouts vary a lot. Download a CSV or Excel statement from net banking for the most accurate report.',
    };
  }
  return { transactions: [], rowsSeen: 0, warning: 'Please upload a CSV, Excel or PDF statement.' };
}

function aoaToObjects(aoa: any[][], hdr = 0): Record<string, any>[] {
  if (!aoa.length) return [];
  const headers = (aoa[hdr] || []).map((c) => String(c).trim());
  return aoa.slice(hdr + 1).map((r) => Object.fromEntries(headers.map((h, j) => [h, r[j]])));
}

/** Holdings export (broker / CDSL / MF app) → holdings rows for /holdings/analyze. */
export async function parseHoldingsBuffer(name: string, buf: Buffer): Promise<{ holdings: HoldingRow[]; warning?: string }> {
  const n = name.toLowerCase();
  let aoa: any[][] = [];
  if (n.endsWith('.csv') || n.endsWith('.txt')) aoa = parseCsv(buf.toString('utf8'));
  else if (n.endsWith('.xlsx') || n.endsWith('.xls')) {
    const XLSX = await loadXlsx();
    const wb = XLSX.read(buf, { type: 'buffer' });
    aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
  } else return { holdings: [], warning: 'Upload the CSV or Excel export of your holdings (from your broker or CDSL/NSDL). PDF holdings reports aren’t supported yet.' };
  let hdr = 0;
  for (let i = 0; i < Math.min(aoa.length, 15); i++) {
    const joined = aoa[i].map((c) => String(c).toLowerCase()).join(' ');
    if (/(instrument|scheme|security|company|name|symbol)/.test(joined) && /(value|qty|quantity|units|price)/.test(joined)) { hdr = i; break; }
  }
  const holdings = rowsToHoldings(aoaToObjects(aoa, hdr));
  return { holdings, warning: holdings.length ? undefined : 'Could not find holdings in this file — make sure it has a name and value/quantity column.' };
}

// ── Text parsers used when the AI reader is off (same as the web app) ──
export interface Form16Data {
  grossSalary: number | null;       // §17(1) salary
  standardDeduction: number | null; // §16(ia)
  chapter6A: number | null;         // total Chapter VI-A deductions
  taxableIncome: number | null;     // total taxable income
  taxOnIncome: number | null;       // tax on total income (pre-cess)
  taxPayable: number | null;        // net tax payable (incl. cess)
  tds: number | null;               // total TDS deducted
}
export function parseForm16(text: string): Form16Data {
  // From a label, skip up to 40 chars (incl. formula refs) to the first proper
  // 2-decimal amount; ignore 0.00 for income fields. Non-greedy so it grabs the
  // nearest real number after the label.
  const pick = (labelSrc: string, allowZero = false): number | null => {
    const m = text.match(new RegExp(labelSrc + '.{0,40}?(\\d[\\d,]*\\.\\d{2})', 'i'));
    if (!m) return null;
    const n = parseFloat(m[1].replace(/,/g, ''));
    if (!isFinite(n) || (!allowZero && n === 0)) return null;
    return Math.round(n * 100);
  };
  // Part A summary row: "Total (Rs.) 1681908.00 127680.00 127680.00"
  // → amount paid/credited, tax deducted, tax deposited.
  const partA = text.match(/total\s*\(\s*rs\.?\s*\)[^\d]{0,8}(\d[\d,]*\.\d{2})\s+(\d[\d,]*\.\d{2})\s+(\d[\d,]*\.\d{2})/i);
  const paFix = (s?: string) => { if (!s) return null; const n = parseFloat(s.replace(/,/g, '')); return isFinite(n) && n > 0 ? Math.round(n * 100) : null; };

  const grossSalary =
    pick('section\\s*17\\s*\\(\\s*1\\s*\\)') ||
    pick('gross\\s*salary') ||
    pick('total\\s*amount\\s*of\\s*salary') ||
    paFix(partA?.[1]);
  const standardDeduction =
    pick('16\\s*\\(\\s*ia\\s*\\)') ||
    pick('standard\\s*deduction');
  const chapter6A = pick('aggregate\\s*of\\s*deductible\\s*amount\\s*under\\s*chapter');
  const taxableIncome =
    pick('total\\s*taxable\\s*income') ||
    pick('total\\s*income\\s*\\(9');
  const taxOnIncome = pick('tax\\s*on\\s*total\\s*income');
  const taxPayable =
    pick('net\\s*tax\\s*payable') ||
    pick('tax\\s*payable');
  const tds =
    pick('total\\s*(?:amount\\s*of\\s*)?tax\\s*deducted') ||
    pick('amount\\s*of\\s*tax\\s*deducted\\s*and\\s*deposited') ||
    paFix(partA?.[3]) || paFix(partA?.[2]);
  return { grossSalary, standardDeduction, chapter6A, taxableIncome, taxOnIncome, taxPayable, tds };
}

// Best-effort payslip parser. Reads the earnings/deductions from a salary slip
// PDF's text. All figures are MONTHLY paise (the caller annualises ×12 for tax).
// Indian payslips often print line items WITHOUT decimals or commas (e.g. "Basic
// Pay 72100"), while totals usually carry 2 decimals ("Total Earning 138965.00")
// — so we accept both, but cap the digit count to avoid grabbing employee IDs or
// account numbers. Anything it can't find is null and the user confirms/edits it.
export function parsePayslip(text: string): {
  gross: number | null; basic: number | null; hra: number | null;
  net: number | null; reimbursements: number | null; tds: number | null;
} {
  // Amount right after a label: integer or 2-decimal, ≤ 9 digits (so a 12–16
  // digit bank/PF account number can never be mistaken for money).
  const AMT = '([\\d,]+(?:\\.\\d{1,2})?)';
  const money = (labelSrc: string): number | null => {
    const m = text.match(new RegExp(labelSrc + '[^0-9-]{0,15}' + AMT, 'i'));
    if (!m) return null;
    const raw = m[1].replace(/,/g, '');
    if (!/^\d{1,9}(\.\d{1,2})?$/.test(raw)) return null; // reject IDs / account nos.
    const n = parseFloat(raw);
    return isNaN(n) ? null : Math.round(n * 100);
  };
  const basic = money('basic(?:\\s*pay|\\s*salary)?');
  const hra =
    money('h\\.?\\s*r\\.?\\s*a\\.?') ||
    money('house\\s*rent\\s*allowance');
  const gross =
    money('gross\\s*(?:earnings|salary|pay|emoluments)') ||
    money('total\\s*earnings?') ||           // "Total Earning Rs. 138965.00"
    money('total\\s*gross') ||
    money('gross');
  const net =
    money('net\\s*(?:pay|salary|payable|amount|in\\s*hand)') ||  // "Net Payable Rs. 118905.00"
    money('take\\s*home');
  const reimbursements = money('reimbursement[s]?');
  const tds =
    money('income\\s*tax') ||               // Indian govt slips label TDS "Income Tax"
    money('t\\.?d\\.?s\\.?') ||
    money('tax\\s*deducted');
  return { gross, basic, hra, net, reimbursements, tds };
}

// Best-effort capital-gains CSV parser (broker P&L export → STCG/LTCG totals).
// Handles (a) explicit short/long-term columns, or (b) a P&L column classified
// by holding period from buy/sell dates. Returns paise (can be negative).

/** Broker P&L export → realised short/long-term gains (paise). Negative = loss. */
export async function parseCapitalGainsBuffer(name: string, buf: Buffer): Promise<{ stcg: number; ltcg: number; rows: number; warning?: string }> {
  const n = name.toLowerCase();
  let aoa: any[][] = [];
  if (n.endsWith('.csv') || n.endsWith('.txt')) aoa = parseCsv(buf.toString('utf8'));
  else if (n.endsWith('.xlsx') || n.endsWith('.xls')) {
    const XLSX = await loadXlsx();
    const wb = XLSX.read(buf, { type: 'buffer' });
    aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
  } else return { stcg: 0, ltcg: 0, rows: 0, warning: 'Upload the CSV or Excel P&L export from your broker.' };
  let hdr = 0;
  for (let i = 0; i < Math.min(aoa.length, 15); i++) {
    const joined = aoa[i].map((c) => String(c).toLowerCase()).join(' ');
    if (/(short.?term|long.?term|stcg|ltcg|realized|realised|p&l|pnl|profit|gain)/.test(joined)) { hdr = i; break; }
  }
  const rows = aoaToObjects(aoa, hdr).filter((r) => Object.values(r).some((v) => String(v ?? '').trim()));
  if (!rows.length) return { stcg: 0, ltcg: 0, rows: 0 };
  const keys = Object.keys(rows[0]);
  const findCol = (re: RegExp) => keys.find((h) => re.test(h.toLowerCase()));
  const num = (val: any) => { const x = parseFloat(String(val ?? '').replace(/[₹,\s]/g, '')); return isNaN(x) ? 0 : x; };
  const stCol = findCol(/short.?term|stcg/), ltCol = findCol(/long.?term|ltcg/);
  let stcg = 0, ltcg = 0;
  if (stCol || ltCol) { for (const r of rows) { stcg += stCol ? num(r[stCol]) : 0; ltcg += ltCol ? num(r[ltCol]) : 0; } }
  else {
    const plCol = findCol(/realized|realised|p&l|pnl|profit|net gain|gain\/loss|gain/);
    const buyCol = findCol(/buy.*date|purchase.*date|acquisi/), sellCol = findCol(/sell.*date|sale.*date|sold/);
    if (plCol) for (const r of rows) {
      const pl = num(r[plCol]);
      if (buyCol && sellCol) { const days = (new Date(r[sellCol]).getTime() - new Date(r[buyCol]).getTime()) / 86400000; if (!isNaN(days) && days > 365) ltcg += pl; else stcg += pl; }
      else stcg += pl;
    }
  }
  return { stcg: Math.round(stcg * 100), ltcg: Math.round(ltcg * 100), rows: rows.length };
}
