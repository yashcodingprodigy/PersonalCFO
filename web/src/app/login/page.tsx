'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Wordmark } from '@/components/Logo';
import { api, setTokens, getTokens, clearCache } from '@/lib/api';

// Email is the primary login until SMS OTP is live (Indian SMS OTP needs TRAI
// DLT registration, which needs an incorporated company). Mobile stays
// available for existing accounts.
type Method = 'email' | 'mobile';

export default function Login() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>('email');
  const [step, setStep] = useState<'enter' | 'otp'>('enter');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Already signed in (e.g. app re-opened) → resume the session.
  useEffect(() => { if (getTokens().access) router.replace('/dashboard'); }, [router]);

  const fullMobile = `+91${mobile}`;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const target = method === 'email' ? email.trim().toLowerCase() : `+91 ${mobile}`;

  function switchMethod(m: Method) { setMethod(m); setStep('enter'); setOtp(''); setErr(''); }

  async function sendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setErr(''); setBusy(true);
    try {
      if (method === 'email') await api('/auth/email/send', { method: 'POST', body: JSON.stringify({ email: email.trim().toLowerCase() }) });
      else await api('/auth/otp/send', { method: 'POST', body: JSON.stringify({ mobile: fullMobile }) });
      setStep('otp');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const res = method === 'email'
        ? await api('/auth/email/verify', { method: 'POST', body: JSON.stringify({ email: email.trim().toLowerCase(), otp }) })
        : await api('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ mobile: fullMobile, otp }) });
      clearCache(); // fresh session — don't show a previous account's cached data
      setTokens(res.access_token, res.refresh_token);
      const ob = res.user?.onboarding_status || {};
      router.push(res.is_new_user || ob.session_1 !== 'complete' ? '/onboarding' : '/dashboard');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  // One-tap demo: logs into a sample account (fake data) — no OTP needed.
  async function tryDemo() {
    setErr(''); setBusy(true);
    try {
      const res = await api('/auth/demo', { method: 'POST', body: '{}' });
      clearCache();
      setTokens(res.access_token, res.refresh_token);
      router.push('/dashboard');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      <section className="hidden lg:flex flex-col justify-between bg-pine-950 text-white p-12">
        <Wordmark dark />
        <div>
          <p className="text-mint-300 text-sm font-bold uppercase tracking-[0.2em] mb-4">Watch your money grow</p>
          <h2 className="font-display text-4xl leading-tight font-medium max-w-md">
            A private CFO for your money — for less than a streaming subscription.
          </h2>
          <p className="mt-6 text-white/60 text-sm max-w-md leading-relaxed">
            No passwords. No bank credentials. Sign in with a one-time code; connect data only
            through consent you can revoke at any time.
          </p>
        </div>
        <p className="text-xs text-white/40">Educational tool · Not SEBI investment advice</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-10"><Wordmark /></div>

          {/* User / CA toggle */}
          <div className="inline-flex rounded-full bg-paper-100 p-1 w-full mb-6">
            <span className="flex-1 rounded-full py-2 text-sm font-bold text-center bg-pine-900 text-white">I'm a user</span>
            <Link href="/ca/login" className="flex-1 rounded-full py-2 text-sm font-bold text-center text-ink-soft hover:text-ink">I'm a CA</Link>
          </div>

          <h1 className="font-display text-3xl font-medium">Welcome</h1>
          <p className="text-sm text-ink-soft mt-2">Sign in or create your account — we’ll send you a one-time code.</p>

          {/* One-tap demo — sample account, no OTP */}
          <button
            type="button" onClick={tryDemo} disabled={busy}
            className="mt-6 w-full rounded-xl border-2 border-mint-500 bg-mint-100/60 px-4 py-3 text-left hover:bg-mint-100 transition disabled:opacity-60"
          >
            <span className="block text-sm font-bold text-pine-900">{busy ? 'Opening demo…' : 'Explore the live demo →'}</span>
            <span className="block text-xs text-ink-soft mt-0.5">One tap, no sign-up. A sample account with example data.</span>
          </button>
          <div className="flex items-center gap-3 mt-6 text-xs text-ink-faint">
            <span className="h-px flex-1 bg-paper-200" />or sign in<span className="h-px flex-1 bg-paper-200" />
          </div>

          {step === 'enter' ? (
            <form onSubmit={sendOtp} className="mt-5 space-y-5">
              {/* Email / Mobile switch */}
              <div className="inline-flex rounded-lg bg-paper-100 p-1 w-full text-sm font-semibold">
                {(['email', 'mobile'] as Method[]).map((m) => (
                  <button key={m} type="button" onClick={() => switchMethod(m)}
                    className={`flex-1 rounded-md py-1.5 ${method === m ? 'bg-white shadow-sm text-ink' : 'text-ink-soft'}`}>
                    {m === 'email' ? 'Email' : 'Mobile'}
                  </button>
                ))}
              </div>
              {method === 'email' ? (
                <div>
                  <label className="label" htmlFor="email">Email address</label>
                  <input id="email" type="email" autoComplete="email" autoFocus className="input" placeholder="you@example.com"
                    value={email} onChange={(e) => setEmail(e.target.value.slice(0, 160))} />
                </div>
              ) : (
                <div>
                  <label className="label" htmlFor="mobile">Mobile number</label>
                  <div className="flex">
                    <span className="inline-flex items-center rounded-l-lg border border-r-0 border-paper-200 bg-paper-100 px-3.5 text-sm font-semibold text-ink-soft">+91</span>
                    <input id="mobile" type="tel" inputMode="numeric" autoFocus className="input rounded-l-none" placeholder="98765 43210"
                      value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} />
                  </div>
                  <p className="text-xs text-ink-faint mt-1.5">SMS codes are rolling out — if yours doesn’t arrive, use Email.</p>
                </div>
              )}
              {err && <p className="text-sm text-signal-red">{err}</p>}
              <button className="btn-primary w-full" disabled={busy || (method === 'email' ? !emailOk : mobile.length !== 10)}>
                {busy ? 'Sending…' : 'Send code'}
              </button>
              <p className="text-xs text-ink-faint leading-relaxed">
                By continuing you agree to our <Link className="underline" href="/legal/terms">Terms</Link> and{' '}
                <Link className="underline" href="/legal/privacy">Privacy Policy</Link>.
              </p>
            </form>
          ) : (
            <form onSubmit={verify} className="mt-8 space-y-5">
              <div>
                <label className="label" htmlFor="otp">Enter the 6-digit code sent to {target}</label>
                <input
                  id="otp" type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus
                  className="input text-center text-2xl tracking-[0.5em] font-bold"
                  value={otp} maxLength={6}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                />
                {method === 'email' && <p className="text-xs text-ink-faint mt-1.5">Can’t see it? Check your spam or promotions folder.</p>}
              </div>
              {err && <p className="text-sm text-signal-red">{err}</p>}
              <button className="btn-primary w-full" disabled={busy || otp.length !== 6}>
                {busy ? 'Verifying…' : 'Verify & continue'}
              </button>
              <div className="flex justify-between text-sm text-ink-soft">
                <button type="button" className="underline" onClick={() => { setStep('enter'); setOtp(''); setErr(''); }}>
                  {method === 'email' ? 'Change email' : 'Change number'}
                </button>
                <button type="button" className="underline disabled:opacity-50" disabled={busy} onClick={() => sendOtp()}>Resend code</button>
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
