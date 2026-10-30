// /v1/files — parse an uploaded file on the server, for clients that can't parse locally
// (the native iOS/Android apps). Nothing is stored here; the client confirms the result and
// then calls the normal endpoints (/statements/analyze, /records/ai-extract, …).
//   POST /files/parse { name, base64, kind: 'statement' | 'holdings' | 'text' }
//     capital_gains → { stcg, ltcg, rows }               (broker P&L CSV / Excel, paise)
//     holdings  → { holdings, warning? }                 (CSV / Excel holdings export)
//     statement → { transactions, rowsSeen, warning? }   (CSV / Excel / PDF bank statement)
//     text      → { text, readable, parsed? }            (PDF → plain text for the AI reader; docType=payslip|form16 adds a basic read)
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { parseCapitalGainsBuffer, parseForm16, parseHoldingsBuffer, parsePayslip, parseStatementBuffer, pdfText } from '../services/fileParse';

export const filesRouter = Router();
filesRouter.use(requireAuth);

const MAX = 8 * 1024 * 1024;
filesRouter.post('/parse', rateLimit({ windowMs: 60_000, max: 20, keyPrefix: 'fparse' }), async (req, res) => {
  const { name, base64, kind } = req.body || {};
  if (typeof name !== 'string' || typeof base64 !== 'string') return res.status(400).json({ error: 'name and base64 are required' });
  const buf = Buffer.from(base64.replace(/^data:[^,]+,/, ''), 'base64');
  if (!buf.length) return res.status(400).json({ error: 'Empty file' });
  if (buf.length > MAX) return res.status(413).json({ error: 'File is larger than 8 MB' });
  try {
    if (kind === 'text') {
      if (!/\.pdf$/i.test(name)) return res.json({ text: buf.toString('utf8').slice(0, 60_000), readable: true });
      const text = (await pdfText(buf)).slice(0, 60_000);
      // Basic deterministic read for salary docs, used by the app when the AI reader is off.
      const docType = String(req.body?.docType || '');
      const parsed = docType === 'form16' ? parseForm16(text) : (docType === 'payslip' || docType === 'employment_letter') ? parsePayslip(text) : undefined;
      return res.json({ text, readable: text.replace(/\s/g, '').length >= 80, parsed });
    }
    if (kind === 'capital_gains') return res.json(await parseCapitalGainsBuffer(name, buf));
    if (kind === 'holdings') return res.json(await parseHoldingsBuffer(name, buf));
    return res.json(await parseStatementBuffer(name, buf));
  } catch (e: any) {
    console.error('[files/parse]', e?.message);
    return res.status(422).json({ error: 'We couldn’t read this file. Try a CSV or Excel export, or a clearer PDF.' });
  }
});
