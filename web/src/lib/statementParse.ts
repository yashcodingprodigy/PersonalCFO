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

// Best-effort Form 16 parse → gross salary + total TDS (paise). Returns nulls
// when it can't find them; the user always confirms the numbers.
export function parseForm16(text: string): { grossSalary: number | null; tds: number | null } {
  const money = (re: RegExp): number | null => {
    const m = text.match(re);
    if (!m) return null;
    const n = parseFloat(m[1].replace(/,/g, ''));
    return isNaN(n) ? null : Math.round(n * 100);
  };
  const grossSalary =
    money(/gross\s*salary[^0-9]{0,40}([\d,]+\.\d{2})/i) ||
    money(/total\s*amount\s*of\s*salary[^0-9]{0,40}([\d,]+\.\d{2})/i) ||
    money(/17\s*\(1\)[^0-9]{0,40}([\d,]+\.\d{2})/i);
  const tds =
    money(/total\s*(?:amount\s*of\s*)?tax\s*deducted[^0-9]{0,40}([\d,]+\.\d{2})/i) ||
    money(/amount\s*of\s*tax\s*deducted\s*and\s*deposited[^0-9]{0,40}([\d,]+\.\d{2})/i);
  return { grossSalary, tds };
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
