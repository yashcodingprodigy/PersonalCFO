'use client';

// Client-side bank-statement parser. Extracts a normalised list of
// transactions from CSV / Excel / PDF files entirely in the browser — the
// raw file never leaves the device; only the parsed rows are sent to the API.
//
// Parser libraries are loaded on demand from cdnjs so they don't bloat the
// main bundle or fight Next's build (pdf.js workers especially).

export interface ParsedTxn {
  date: string;        // YYYY-MM-DD
  description: string;
  amount: number;      // paise, positive
  direction: 'debit' | 'credit';
}

export interface ParseResult {
  transactions: ParsedTxn[];
  rowsSeen: number;
  warning?: string;
}

const CDN = {
  papa: 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js',
  xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
};

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

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

// Extract all text from a PDF (used for best-effort Form 16 reading).
export async function readPdfText(file: File): Promise<string> {
  await loadScript(CDN.pdf);
  const pdfjsLib = (window as any).pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc = CDN.pdfWorker;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += ' ' + content.items.map((it: any) => it.str).join(' ');
  }
  return text.replace(/\s+/g, ' ');
}

// Best-effort Form 16 parse. A real Form 16 (Part B) lays out clearly-labelled
// totals, so we read the salary, taxable income and tax figures directly. All
// amounts on a Form 16 carry 2 decimals (e.g. 1688816.00), so we require a
// decimal — this avoids grabbing the section numbers (17(1), 16(ia), 80C) and
// the formula references like (9-11). The user always confirms the numbers.
// `grossSalary` and `tds` are kept for backward compatibility with callers.
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
export async function parseCapitalGainsCsv(file: File): Promise<{ stcg: number; ltcg: number; rows: number }> {
  await loadScript(CDN.papa);
  const Papa = (window as any).Papa;
  const text = await file.text();
  const rows = (Papa.parse(text, { header: true, skipEmptyLines: true }).data as any[]).filter((r) => r && Object.keys(r).length);
  if (!rows.length) return { stcg: 0, ltcg: 0, rows: 0 };
  const keys = Object.keys(rows[0]);
  const findCol = (re: RegExp) => keys.find((h) => re.test(h.toLowerCase()));
  const num = (val: any) => { const n = parseFloat(String(val ?? '').replace(/[₹,\s]/g, '')); return isNaN(n) ? 0 : n; };

  const stCol = findCol(/short.?term|stcg/);
  const ltCol = findCol(/long.?term|ltcg/);
  let stcg = 0, ltcg = 0;

  if (stCol || ltCol) {
    for (const r of rows) { stcg += stCol ? num(r[stCol]) : 0; ltcg += ltCol ? num(r[ltCol]) : 0; }
  } else {
    const plCol = findCol(/realized|realised|p&l|pnl|profit|net gain|gain\/loss|gain/);
    const buyCol = findCol(/buy.*date|purchase.*date|acquisi/);
    const sellCol = findCol(/sell.*date|sale.*date|sold/);
    if (plCol) {
      for (const r of rows) {
        const p = num(r[plCol]);
        if (buyCol && sellCol) {
          const days = (new Date(r[sellCol]).getTime() - new Date(r[buyCol]).getTime()) / 86400000;
          if (!isNaN(days) && days > 365) ltcg += p; else stcg += p;
        } else stcg += p;
      }
    }
  }
  return { stcg: Math.round(stcg * 100), ltcg: Math.round(ltcg * 100), rows: rows.length };
}

// ── Holdings report parser (broker / CDSL / mutual-fund export) ──────
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

export async function parseHoldingsFile(file: File): Promise<{ holdings: HoldingRow[]; warning?: string }> {
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'csv' || ext === 'txt') {
    await loadScript(CDN.papa);
    const Papa = (window as any).Papa;
    const text = await file.text();
    let rows = (Papa.parse(text, { header: true, skipEmptyLines: true }).data as any[]).filter((r) => r && Object.keys(r).length);
    // Some broker CSVs have title rows before the header — retry from the row
    // that looks like a header if the first pass found no value-like column.
    const holdings = rowsToHoldings(rows);
    return { holdings, warning: holdings.length ? undefined : 'Could not find holdings in this CSV — make sure it has a name and value/quantity column.' };
  }
  if (ext === 'xlsx' || ext === 'xls') {
    await loadScript(CDN.xlsx);
    const XLSX = (window as any).XLSX;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const aoa: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
    // find the header row (the one with a name-ish and value-ish header)
    let hdr = 0;
    for (let i = 0; i < Math.min(aoa.length, 15); i++) {
      const joined = aoa[i].map((c) => String(c).toLowerCase()).join(' ');
      if (/(instrument|scheme|security|company|name|symbol)/.test(joined) && /(value|qty|quantity|units|price)/.test(joined)) { hdr = i; break; }
    }
    const headers = aoa[hdr].map((c) => String(c).trim());
    const objs = aoa.slice(hdr + 1).map((r) => Object.fromEntries(headers.map((h, j) => [h, r[j]])));
    const holdings = rowsToHoldings(objs);
    return { holdings, warning: holdings.length ? undefined : 'Could not read holdings from this Excel file.' };
  }
  // PDF holdings vary too much to parse reliably; ask for CSV/Excel.
  return { holdings: [], warning: 'For best results, upload the CSV or Excel export of your holdings (from your broker or CDSL/NSDL). PDF holdings reports aren’t supported yet.' };
}

// ── public entry ─────────────────────────────────────────────────────
export async function parseStatementFile(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    await loadScript(CDN.papa);
    const text = await file.text();
    const Papa = (window as any).Papa;
    const res = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: false });
    let txns = mapObjectRows(res.data as any[]);
    if (txns.length === 0) {
      // Retry without header (some bank CSVs have preamble rows)
      const res2 = Papa.parse(text, { header: false, skipEmptyLines: true });
      const rows = (res2.data as any[][]).filter((r) => r.length >= 3);
      txns = mapArrayRows(rows);
    }
    return { transactions: txns, rowsSeen: (res.data as any[]).length, warning: txns.length === 0 ? 'No transactions could be read from this CSV. Check that it has Date, Description and amount columns.' : undefined };
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    await loadScript(CDN.xlsx);
    const XLSX = (window as any).XLSX;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const aoa: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
    const txns = mapArrayRows(aoa);
    return { transactions: txns, rowsSeen: aoa.length, warning: txns.length === 0 ? 'No transactions could be read from this spreadsheet.' : undefined };
  }

  if (name.endsWith('.pdf')) {
    await loadScript(CDN.pdf);
    const pdfjsLib = (window as any).pdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = CDN.pdfWorker;
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let allLines: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      allLines = allLines.concat(lineFromItems(content.items));
    }
    const txns = parsePdfLines(allLines);
    return {
      transactions: txns, rowsSeen: allLines.length,
      warning: txns.length === 0
        ? 'We couldn\'t read transactions from this PDF — bank PDF layouts vary a lot. Try downloading a CSV or Excel statement from your net banking for the most accurate report.'
        : 'PDF reading is best-effort — please sanity-check the totals against your statement.',
    };
  }

  throw new Error('Unsupported file. Upload a CSV, Excel (.xlsx) or PDF bank statement.');
}

// Map header-less rows (array of arrays): detect the header row, then delegate.
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
