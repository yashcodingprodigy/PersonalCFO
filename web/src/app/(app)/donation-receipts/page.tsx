'use client';

import { useState } from 'react';
import { inr } from '@/lib/format';

// 80G donation receipt generator — the receipt a donor needs to claim the
// Section 80G deduction. (The donee org issues the official one; this helps
// donors keep a clean record / draft.)
export default function DonationReceiptsPage() {
  const [f, setF] = useState({ donor: '', donorPan: '', donee: '', doneePan: '', reg80g: '', amount: '', date: '', mode: 'Bank transfer', purpose: '' });
  const [show, setShow] = useState(false);
  const set = (k: string) => (e: any) => setF((p) => ({ ...p, [k]: e.target.value }));
  const amt = Number(f.amount) || 0;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="no-print">
        <h1 className="font-display text-3xl font-medium">80G donation receipt</h1>
        <p className="text-sm text-ink-soft mt-1">Record a donation for your Section 80G tax deduction, then print or save as PDF.</p>
      </div>

      {!show ? (
        <section className="card p-6 space-y-4 no-print">
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">Donor name (you)</label><input className="input" value={f.donor} onChange={set('donor')} /></div>
            <div><label className="label">Donor PAN</label><input className="input uppercase" value={f.donorPan} onChange={set('donorPan')} placeholder="ABCDE1234F" /></div>
            <div><label className="label">Organisation (donee)</label><input className="input" value={f.donee} onChange={set('donee')} /></div>
            <div><label className="label">Organisation PAN</label><input className="input uppercase" value={f.doneePan} onChange={set('doneePan')} /></div>
            <div><label className="label">80G registration no.</label><input className="input" value={f.reg80g} onChange={set('reg80g')} placeholder="AAAAA0000A / 12345" /></div>
            <div><label className="label">Amount (₹)</label><input className="input" inputMode="numeric" value={f.amount} onChange={(e) => setF((p) => ({ ...p, amount: e.target.value.replace(/[^\d]/g, '') }))} /></div>
            <div><label className="label">Date of donation</label><input type="date" className="input" value={f.date} onChange={set('date')} /></div>
            <div><label className="label">Mode</label><select className="input" value={f.mode} onChange={set('mode')}><option>Bank transfer</option><option>UPI</option><option>Cheque</option><option>Cash</option></select></div>
            <div className="sm:col-span-2"><label className="label">Purpose (optional)</label><input className="input" value={f.purpose} onChange={set('purpose')} placeholder="General donation / corpus / relief fund" /></div>
          </div>
          {f.mode === 'Cash' && amt > 2000 && <p className="text-xs text-signal-amber">Cash donations over ₹2,000 do not qualify for 80G — pay digitally to claim the deduction.</p>}
          <button onClick={() => setShow(true)} disabled={!f.donor || !f.donee || !amt} className="btn-primary">Generate receipt</button>
        </section>
      ) : (
        <>
          <div className="flex gap-2 no-print">
            <button onClick={() => window.print()} className="btn-primary">Print / Save as PDF</button>
            <button onClick={() => setShow(false)} className="btn-secondary">Edit details</button>
          </div>
          <div className="card p-8">
            <div className="text-center border-b border-paper-200 pb-4 mb-5">
              <h2 className="font-display text-xl font-semibold">{f.donee || 'Donation Receipt'}</h2>
              <p className="text-xs text-ink-faint mt-1">Receipt for donation under Section 80G of the Income-tax Act, 1961</p>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {[['Received from', f.donor], ['Donor PAN', f.donorPan?.toUpperCase()], ['Amount', `${inr(amt * 100)}`], ['Date', f.date ? new Date(f.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'], ['Mode of payment', f.mode], ['Purpose', f.purpose || 'General donation'], ['Organisation PAN', f.doneePan?.toUpperCase()], ['80G registration', f.reg80g]].map(([k, v]) => (
                  (v ? <tr key={k as string} className="border-b border-paper-100"><td className="py-2 text-ink-soft w-1/2">{k}</td><td className="py-2 font-semibold">{v}</td></tr> : null)
                ))}
              </tbody>
            </table>
            <div className="mt-10 flex justify-end text-sm">
              <div className="text-center"><div className="w-44 border-b border-ink-faint mb-1" /><p className="text-xs text-ink-faint">Authorised signatory</p></div>
            </div>
            <p className="text-[10px] text-ink-faint mt-6 leading-relaxed">Keep this with your tax records. The donee organisation must also report your donation in Form 10BD; verify it reflects in your AIS before claiming 80G.</p>
          </div>
        </>
      )}
    </div>
  );
}
