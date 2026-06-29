'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { get } from '@/lib/api';
import { inr } from '@/lib/format';

const ITR_FORMS = [
  { code: 'ITR-1', name: 'Sahaj', who: 'Most salaried people. Salary/pension, one house, interest income, and total income under ₹50 lakh. No capital gains.' },
  { code: 'ITR-2', name: 'ITR-2', who: 'You sold shares, mutual funds or property (capital gains), own more than one house, earn over ₹50 lakh, or have foreign assets — but no business income.' },
  { code: 'ITR-3', name: 'ITR-3', who: 'You run a business or work as a professional/freelancer and keep regular books (not the simplified presumptive scheme).' },
  { code: 'ITR-4', name: 'Sugam', who: 'Small business or freelancer using the presumptive scheme (44AD/44ADA) with income under ₹50 lakh — the simplest business return.' },
];

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center shrink-0">
        <span className="grid place-items-center w-8 h-8 rounded-full bg-pine-900 text-white text-sm font-bold">{n}</span>
        <span className="w-px flex-1 bg-paper-200 my-1" />
      </div>
      <div className="pb-6 min-w-0">
        <h3 className="text-sm font-bold">{title}</h3>
        <div className="text-sm text-ink-soft leading-relaxed mt-1 space-y-2">{children}</div>
      </div>
    </div>
  );
}

export default function FileItYourself() {
  const [f, setF] = useState<any>(null);
  useEffect(() => { get('/tax/full').then(setF).catch(() => {}); }, []);

  const fy = f?.fy || '';
  const ay = fy ? `${Number(fy.slice(0, 4)) + 1}-${String(Number(fy.slice(0, 4)) + 2).slice(2)}` : '';
  const rec = f ? (f.recommendedRegime === 'old' ? f.old : f.new) : null;
  const refund = rec?.refundOrPayable ?? 0;

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <Link href="/file" className="text-sm text-pine-700 underline">← Prepare ITR docs</Link>
        <h1 className="font-display text-3xl font-medium mt-2">File your ITR yourself</h1>
        <p className="text-sm text-ink-soft mt-1">A simple, step-by-step guide to filing your own income-tax return on the government portal — no jargon. Filing for FY {fy} (assessment year {ay}) is usually due by <strong>31 July {fy ? Number(fy.slice(0, 4)) + 1 : ''}</strong>.</p>
      </div>

      {/* Personalised snapshot */}
      {f && (
        <div className="rounded-2xl bg-gradient-to-br from-pine-950 to-pine-900 text-white p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-mint-300">Based on your data</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-3">
            <div><p className="text-[10px] uppercase tracking-wider text-white/50">Your form</p><p className="font-display text-xl font-semibold">{f.form.code}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-white/50">Regime</p><p className="font-display text-xl font-semibold capitalize">{f.recommendedRegime}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-white/50">{refund >= 0 ? 'Refund due' : 'Tax payable'}</p><p className="font-display text-xl font-semibold text-mint-300">{inr(Math.abs(refund))}</p></div>
          </div>
          <p className="text-xs text-white/70 mt-3">{f.form.why} See the full breakdown on the <Link href="/tax" className="underline text-mint-300">Tax page</Link> and download it for reference while filing.</p>
        </div>
      )}

      {/* Steps */}
      <div className="card p-6">
        <Step n={1} title="Gather your documents">
          <p>Keep these handy (you don’t upload them while filing, but you’ll need the numbers): PAN & Aadhaar, Form 16, Form 26AS & AIS, bank-interest certificate, capital-gains statement, and your 80C/80D/loan proofs.</p>
          <p><Link href="/file" className="text-pine-700 underline">Use “Prepare ITR docs”</Link> to collect them all in one place first.</p>
        </Step>
        <Step n={2} title="Download your AIS and Form 26AS">
          <p><strong>AIS</strong> (Annual Information Statement) and <strong>Form 26AS</strong> are the tax department’s own record of your income and the TDS already deducted. Always file to match these.</p>
          <p>On <a href="https://www.incometax.gov.in" target="_blank" rel="noopener noreferrer" className="text-pine-700 underline">incometax.gov.in</a>: log in → <em>Services → AIS</em> to download the AIS, and <em>e-File → Income Tax Returns → View Form 26AS</em> for 26AS. Check that the income and TDS there match what PayWatch computed.</p>
        </Step>
        <Step n={3} title="Know which ITR form is yours">
          <p>The portal will ask which form to file. Based on your data you’ll likely file <strong>{f?.form.code || 'ITR-1 or ITR-2'}</strong>. Here’s what each one is for:</p>
          <div className="space-y-2 mt-1">
            {ITR_FORMS.map((x) => (
              <div key={x.code} className={`rounded-lg border p-3 ${f?.form.code === x.code ? 'border-mint-500 bg-mint-50' : 'border-paper-200'}`}>
                <p className="text-sm font-bold">{x.code} <span className="font-normal text-ink-faint">· {x.name}</span> {f?.form.code === x.code && <span className="chip bg-mint-100 text-pine-800 text-[10px] ml-1">Likely yours</span>}</p>
                <p className="text-xs text-ink-soft mt-0.5">{x.who}</p>
              </div>
            ))}
          </div>
        </Step>
        <Step n={4} title="Log in to the income-tax portal">
          <p>Go to <a href="https://www.incometax.gov.in" target="_blank" rel="noopener noreferrer" className="text-pine-700 underline">incometax.gov.in</a> and log in with your PAN (that’s your user ID) and password, or via Aadhaar OTP. First time? Click <em>Register</em> and verify with an OTP.</p>
        </Step>
        <Step n={5} title="Start the return">
          <p>Go to <em>e-File → Income Tax Returns → File Income Tax Return</em>. Select assessment year <strong>{ay || '(this year)'}</strong>, choose <em>Online</em> mode, and pick the <strong>{f?.form.code || 'right'}</strong> form when asked. Choose the <strong>{f?.recommendedRegime || 'recommended'}</strong> regime — PayWatch already checked which saves you more.</p>
        </Step>
        <Step n={6} title="Check the pre-filled data">
          <p>The portal pre-fills most things from your AIS — salary, TDS, interest. <strong>Cross-check every figure</strong> against your documents and the PayWatch computation. Add anything missing: capital gains, other interest, deductions (80C, 80D, home-loan interest, HRA).</p>
          <p>The final tax should match what PayWatch showed: <strong>{rec ? `${refund >= 0 ? 'a refund of ' : 'tax payable of '}${inr(Math.abs(refund))}` : 'your computed figure'}</strong>. If it’s very different, something’s entered wrong — recheck.</p>
        </Step>
        <Step n={7} title="Pay any tax due (or claim your refund)">
          <p>If tax is payable, pay it via <em>e-Pay Tax</em> (net-banking/UPI) and enter the challan details. If a refund is due, just make sure your bank account is <strong>pre-validated</strong> under <em>Profile → My Bank Account</em> so the refund can land.</p>
        </Step>
        <Step n={8} title="Submit and e-verify">
          <p>Review the summary and <strong>Submit</strong>. Then <strong>e-verify within 30 days</strong> — easiest is Aadhaar OTP. Your return isn’t valid until verified. You’ll get the ITR-V acknowledgement by email. <span className="text-signal-green font-semibold">Done!</span></p>
        </Step>
        <div className="flex gap-4">
          <div className="flex flex-col items-center shrink-0"><span className="grid place-items-center w-8 h-8 rounded-full bg-signal-green text-white text-sm font-bold">✓</span></div>
          <p className="text-sm text-ink-soft">That’s it — keep the ITR-V and your documents safe for a few years in case of any query.</p>
        </div>
      </div>

      {/* Common mistakes */}
      <div className="card p-6 border-l-4 border-l-signal-amber">
        <h2 className="text-sm font-bold uppercase tracking-widest text-signal-amber mb-3">Avoid these common slip-ups</h2>
        <ul className="space-y-2 text-sm text-ink-soft leading-relaxed">
          <li className="flex gap-2"><span className="text-signal-amber font-bold shrink-0">✕</span>Forgetting to e-verify — an unverified return is treated as not filed.</li>
          <li className="flex gap-2"><span className="text-signal-amber font-bold shrink-0">✕</span>Not reporting savings/FD interest or small capital gains — they’re in your AIS, so the dept already knows.</li>
          <li className="flex gap-2"><span className="text-signal-amber font-bold shrink-0">✕</span>Picking the wrong regime without comparing — check the Tax page first.</li>
          <li className="flex gap-2"><span className="text-signal-amber font-bold shrink-0">✕</span>Missing the 31 July deadline — late filing means a penalty and lost loss-carry-forward.</li>
        </ul>
      </div>

      {f?.needsCA?.required && (
        <div className="card p-5 border-l-4 border-l-signal-red">
          <p className="text-sm text-ink-soft"><strong>One thing:</strong> {f.needsCA.reason}</p>
        </div>
      )}

      <p className="text-[11px] text-ink-faint leading-relaxed">This guide is educational. PayWatch helps you prepare and self-file; it isn’t a substitute for a Chartered Accountant where an audit or certification is legally required. Always verify against the official portal before submitting.</p>
    </div>
  );
}
