'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Wordmark } from '@/components/Logo';
import { caPost, setCaTokens } from '@/lib/caApi';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/v1';

export default function CaLogin() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [icai, setIcai] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [firm, setFirm] = useState('');
  const [frn, setFrn] = useState('');
  const [cop, setCop] = useState('');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [gstin, setGstin] = useState('');
  const [showMore, setShowMore] = useState(false);

  const fullMobile = `+91${mobile}`;

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    if (!/^[6-9]\d{9}$/.test(mobile)) { setErr('Enter a valid 10-digit mobile number.'); return; }
    if (mode === 'signup') {
      if (name.trim().length < 2) { setErr('Please enter your full name.'); return; }
      if (icai.trim().length < 3) { setErr('Please enter your ICAI membership number.'); return; }
      if (!/^\S+@\S+\.\S+$/.test(email)) { setErr('Please enter a valid email.'); return; }
      if (!city.trim()) { setErr('Please enter your city.'); return; }
    }
    setBusy(true);
    try {
      const res = await fetch(`${API}/auth/otp/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mobile: fullMobile }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || 'Could not send OTP'); }
      setStep('otp');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const body: any = { mobile: fullMobile, otp };
      if (mode === 'signup') Object.assign(body, {
        name, icai_number: icai, email, city,
        firm_name: firm || undefined, frn: frn || undefined, cop_number: cop || undefined,
        office_address: address || undefined, website: website || undefined, gstin: gstin || undefined,
      });
      const res = await caPost(mode === 'signup' ? '/ca/auth/register' : '/ca/auth/login', body);
      setCaTokens(res.access_token, res.refresh_token);
      router.push('/ca');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-pine-950 text-white px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6"><Wordmark dark size="lg" /></div>
        <p className="text-center text-xs uppercase tracking-[0.2em] text-mint-300 font-bold mb-6">For Chartered Accountants</p>

        <div className="card bg-white text-ink p-6">
          {/* Login / Signup toggle */}
          <div className="inline-flex rounded-full bg-paper-100 p-1 w-full mb-5">
            {(['login', 'signup'] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setStep('details'); setErr(''); }}
                className={`flex-1 rounded-full py-2 text-sm font-bold capitalize transition-colors ${mode === m ? 'bg-pine-900 text-white' : 'text-ink-soft'}`}>
                {m === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>

          {step === 'details' ? (
            <form onSubmit={sendOtp} className="space-y-3">
              {mode === 'signup' && (
                <>
                  <div><label className="label">Full name *</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="CA Jane Doe" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label">ICAI membership no. *</label><input className="input" value={icai} onChange={(e) => setIcai(e.target.value)} placeholder="123456" /></div>
                    <div><label className="label">City *</label><input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bengaluru" /></div>
                  </div>
                  <div><label className="label">Email *</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div>
                  <div><label className="label">Firm / Practice name</label><input className="input" value={firm} onChange={(e) => setFirm(e.target.value)} placeholder="If any (e.g. Doe & Associates)" /></div>

                  <button type="button" onClick={() => setShowMore((s) => !s)} className="text-xs text-pine-700 underline">{showMore ? '− Hide' : '+ Add'} practice details (optional)</button>
                  {showMore && (
                    <div className="space-y-3 border-l-2 border-paper-200 pl-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="label">FRN</label><input className="input" value={frn} onChange={(e) => setFrn(e.target.value)} placeholder="Firm reg. no." /></div>
                        <div><label className="label">COP number</label><input className="input" value={cop} onChange={(e) => setCop(e.target.value)} placeholder="If practising" /></div>
                      </div>
                      <div><label className="label">Office address</label><input className="input" value={address} onChange={(e) => setAddress(e.target.value)} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="label">Website</label><input className="input" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="example.com" /></div>
                        <div><label className="label">GSTIN</label><input className="input" value={gstin} onChange={(e) => setGstin(e.target.value)} /></div>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div>
                <label className="label">Mobile number</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-paper-200 bg-paper-50 text-sm text-ink-soft">+91</span>
                  <input className="input rounded-l-none" inputMode="numeric" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/[^\d]/g, '').slice(0, 10))} placeholder="9876543210" />
                </div>
              </div>
              {err && <p className="text-sm text-signal-red">{err}</p>}
              <button className="btn-primary w-full" disabled={busy}>{busy ? 'Sending…' : 'Send OTP'}</button>
            </form>
          ) : (
            <form onSubmit={verify} className="space-y-3">
              <p className="text-sm text-ink-soft">We sent a 6-digit code to <strong>{fullMobile}</strong>.</p>
              <div><label className="label">Enter OTP</label><input className="input tracking-[0.4em] text-center text-lg" inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, '').slice(0, 6))} placeholder="------" /></div>
              {err && <p className="text-sm text-signal-red">{err}</p>}
              <button className="btn-primary w-full" disabled={busy || otp.length !== 6}>{busy ? 'Verifying…' : mode === 'signup' ? 'Create CA account' : 'Log in'}</button>
              <button type="button" onClick={() => { setStep('details'); setOtp(''); setErr(''); }} className="text-xs text-ink-faint underline w-full">Change details</button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-white/60 mt-5">
          Not a CA? <Link href="/login" className="text-mint-300 underline">Log in as a user</Link>
        </p>
      </div>
    </main>
  );
}
