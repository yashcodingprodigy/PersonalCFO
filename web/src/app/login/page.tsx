'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Wordmark } from '@/components/Logo';
import { api, setTokens } from '@/lib/api';

export default function Login() {
  const router = useRouter();
  const [step, setStep] = useState<'mobile' | 'otp'>('mobile');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const fullMobile = `+91${mobile}`;

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await api('/auth/otp/send', { method: 'POST', body: JSON.stringify({ mobile: fullMobile }) });
      setStep('otp');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const res = await api('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ mobile: fullMobile, otp }) });
      setTokens(res.access_token, res.refresh_token);
      const ob = res.user?.onboarding_status || {};
      router.push(res.is_new_user || ob.session_1 !== 'complete' ? '/onboarding' : '/dashboard');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      <section className="hidden lg:flex flex-col justify-between bg-pine-950 text-white p-12">
        <Wordmark dark />
        <div>
          <h2 className="font-display text-4xl leading-tight font-medium max-w-md">
            The financial clarity of a private CFO — for the price of a streaming subscription.
          </h2>
          <p className="mt-6 text-white/60 text-sm max-w-md leading-relaxed">
            No passwords. No bank credentials. Sign in with your mobile number; connect data only
            through RBI-regulated consent you can revoke at any time.
          </p>
        </div>
        <p className="text-xs text-white/40">Educational tool · Not SEBI investment advice</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-10"><Wordmark /></div>
          <h1 className="font-display text-3xl font-medium">Welcome</h1>
          <p className="text-sm text-ink-soft mt-2">Sign in or create your account with your mobile number.</p>

          {step === 'mobile' ? (
            <form onSubmit={sendOtp} className="mt-8 space-y-5">
              <div>
                <label className="label" htmlFor="mobile">Mobile number</label>
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-lg border border-r-0 border-paper-200 bg-paper-100 px-3.5 text-sm font-semibold text-ink-soft">+91</span>
                  <input
                    id="mobile" type="tel" inputMode="numeric" autoFocus
                    className="input rounded-l-none" placeholder="98765 43210"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  />
                </div>
              </div>
              {err && <p className="text-sm text-signal-red">{err}</p>}
              <button className="btn-primary w-full" disabled={busy || mobile.length !== 10}>
                {busy ? 'Sending…' : 'Send OTP'}
              </button>
              <p className="text-xs text-ink-faint leading-relaxed">
                By continuing you agree to our <Link className="underline" href="/legal/terms">Terms</Link> and{' '}
                <Link className="underline" href="/legal/privacy">Privacy Policy</Link>.
              </p>
            </form>
          ) : (
            <form onSubmit={verify} className="mt-8 space-y-5">
              <div>
                <label className="label" htmlFor="otp">Enter the 6-digit OTP sent to +91 {mobile}</label>
                <input
                  id="otp" type="text" inputMode="numeric" autoFocus
                  className="input text-center text-2xl tracking-[0.5em] font-bold"
                  value={otp} maxLength={6}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              {err && <p className="text-sm text-signal-red">{err}</p>}
              <button className="btn-primary w-full" disabled={busy || otp.length !== 6}>
                {busy ? 'Verifying…' : 'Verify & continue'}
              </button>
              <button type="button" className="text-sm text-ink-soft underline w-full" onClick={() => { setStep('mobile'); setOtp(''); }}>
                Change number
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
