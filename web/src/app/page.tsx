'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Wordmark, LogoMark } from '@/components/Logo';
import { AuthRedirect } from '@/components/AuthRedirect';

/* ── helpers ─────────────────────────────────────────────────────────── */
function inrCompact(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
function fv(monthly: number, annualRate: number, years: number, stepUp: number): number {
  let total = 0, p = monthly;
  const i = annualRate / 12;
  for (let y = 0; y < years; y++) {
    for (let m = 0; m < 12; m++) total = (total + p) * (1 + i);
    p *= 1 + stepUp;
  }
  return total;
}

function useInView<T extends HTMLElement>(threshold = 0.3) {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } });
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, seen };
}

function CountUp({ to, dur = 1400, prefix = '', suffix = '', decimals = 0 }: { to: number; dur?: number; prefix?: string; suffix?: string; decimals?: number }) {
  const { ref, seen } = useInView<HTMLSpanElement>(0.6);
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!seen) return;
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setV(to * e);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, to, dur]);
  return <span ref={ref}>{prefix}{v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}

/* Animated 270° money-health gauge that counts up when seen */
function Gauge({ score = 78 }: { score?: number }) {
  const { ref, seen } = useInView<HTMLDivElement>(0.5);
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!seen) return;
    let raf = 0; const t0 = performance.now(); const dur = 1600;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(score * e);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, score]);
  const R = 78, C = 2 * Math.PI * R, arc = C * 0.75;
  const off = arc * (1 - val / 100);
  return (
    <div ref={ref} className="relative w-[196px] h-[196px]">
      <svg width="196" height="196" viewBox="0 0 200 200" className="-rotate-[135deg]">
        <circle cx="100" cy="100" r={R} fill="none" stroke="#EDEBE4" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${arc} ${C}`} />
        <circle cx="100" cy="100" r={R} fill="none" stroke="url(#gaugeG)" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${arc} ${C}`} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset .1s linear' }} />
        <defs>
          <linearGradient id="gaugeG" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#0F3D34" /><stop offset="0.6" stopColor="#2FBC9B" /><stop offset="1" stopColor="#7FE0C8" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-5xl font-semibold text-pine-900 tabular-nums">{Math.round(val)}</span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-ink-faint mt-1">Money Health</span>
      </div>
    </div>
  );
}

const PILLARS = [
  { icon: 'M4 4h16v12H7l-3 3V4Zm4 5h8v2H8V9Z', title: 'Ask your CFO', body: 'A finance expert that actually knows your numbers.' },
  { icon: 'M3 13h2v7H3v-7Zm4-4h2v11H7V9Zm4-5h2v16h-2V4Zm4 8h2v8h-2v-8Z', title: 'One score', body: 'Your whole financial life as a single number, moving up.' },
  { icon: 'M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4Z', title: 'Protected', body: 'Insurance, tax and emergencies — checked, sized, sorted.' },
  { icon: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z', title: 'Told what to do', body: 'Not more charts — exact steps, in rupees, ranked.' },
];

const FEATURES = [
  {
    tag: 'Ask PayWatch', title: 'Answers, in your own numbers.',
    body: 'Prepay the loan or invest? It knows your rate, your surplus, your tax — and answers in plain English.',
    visual: 'chat',
  },
  {
    tag: 'Tax Copilot', title: 'Keep more of what you earn.',
    body: 'Every deduction, both regimes, a computed return your CA can file from — or you file yourself.',
    visual: 'tax',
  },
  {
    tag: 'Money Health Score', title: 'Six dimensions. One number.',
    body: 'Savings, insurance, diversification, emergency, debt, tax — benchmarked, not guessed.',
    visual: 'score',
  },
  {
    tag: 'Insurance & Invest', title: 'Covered, and growing.',
    body: 'Right-sized cover and category-level investing guidance — no products pushed, ever.',
    visual: 'shield',
  },
];

function FeatureVisual({ kind }: { kind: string }) {
  if (kind === 'chat') return (
    <div className="space-y-2.5 w-full">
      <div className="flex justify-end"><div className="max-w-[80%] rounded-2xl rounded-br-md bg-mint-500 text-pine-950 px-4 py-2.5 text-sm font-medium">Prepay my loan or invest?</div></div>
      <div className="flex justify-start"><div className="max-w-[86%] rounded-2xl rounded-bl-md pw-glass px-4 py-2.5 text-sm leading-relaxed text-white/90">Your loan costs ~6% after tax; index funds have done 11–12% (not guaranteed). A 50/50 split until your EMI is under 30% of take-home. Want the exact numbers?</div></div>
    </div>
  );
  if (kind === 'tax') return (
    <div className="w-full space-y-3">
      {[['Old regime', 74], ['New regime', 46]].map(([l, w], i) => (
        <div key={l as string}>
          <div className="flex justify-between text-xs text-white/70 mb-1"><span>{l}</span><span className="tabular-nums">{i ? '₹46,800' : '₹74,200'}</span></div>
          <div className="h-2.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${w}%`, background: i ? 'linear-gradient(90deg,#2FBC9B,#7FE0C8)' : 'rgba(255,255,255,0.25)' }} /></div>
        </div>
      ))}
      <p className="text-xs text-mint-300 font-semibold pt-1">Save ₹27,400 — new regime wins for you.</p>
    </div>
  );
  if (kind === 'score') return <div className="flex items-center justify-center w-full"><Gauge score={78} /></div>;
  return (
    <div className="grid grid-cols-2 gap-3 w-full">
      {[['Term life', '92%'], ['Health', '61%'], ['Emergency', '78%'], ['Diversified', '70%']].map(([l, v]) => (
        <div key={l} className="pw-glass rounded-xl p-3">
          <p className="text-[11px] text-white/60">{l}</p>
          <p className="font-display text-2xl font-semibold text-white">{v}</p>
        </div>
      ))}
    </div>
  );
}

export default function Landing() {
  const [monthly, setMonthly] = useState(15000);
  const [scrolled, setScrolled] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // scroll reveals
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('.pw-reveal'));
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.14 });
    els.forEach((el) => io.observe(el));
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { io.disconnect(); window.removeEventListener('scroll', onScroll); };
  }, []);

  const doNothing = fv(monthly, 0.035, 10, 0);
  const withPW = fv(monthly, 0.11, 10, 0.08);
  const gap = withPW - doNothing;

  function onMove(e: React.MouseEvent) {
    const el = cardRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: -py * 8, y: px * 10 });
  }

  return (
    <main className="min-h-screen bg-pine-950 text-white overflow-x-hidden">
      <AuthRedirect />

      {/* Nav */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all ${scrolled ? 'bg-pine-950/80 backdrop-blur-md border-b border-white/10' : ''}`}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Wordmark dark />
          <nav className="flex items-center gap-6 text-sm text-white/70">
            <a href="#features" className="hover:text-white transition-colors hidden sm:block">Features</a>
            <a href="#value" className="hover:text-white transition-colors hidden sm:block">Why now</a>
            <a href="#pricing" className="hover:text-white transition-colors hidden sm:block">Pricing</a>
            <Link href="/login" className="rounded-full bg-white text-pine-950 px-5 py-2 font-semibold hover:bg-mint-100 transition-colors">Sign in</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-36 pb-28 overflow-hidden">
        <div className="pw-aurora absolute inset-0 -z-10" />
        <div className="absolute -z-10 top-10 -left-24 w-96 h-96 rounded-full bg-mint-500/20 blur-3xl pw-blob" />
        <div className="absolute -z-10 bottom-0 right-0 w-[28rem] h-[28rem] rounded-full bg-signal-teal/10 blur-3xl pw-blob" style={{ animationDelay: '-6s' }} />

        <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-14 items-center">
          <div className="pw-reveal">
            <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.15em] uppercase text-mint-300 pw-glass rounded-full px-3 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-mint-400 pw-float2" /> India&apos;s money operating system
            </span>
            <h1 className="font-display text-5xl sm:text-6xl leading-[1.03] font-medium">
              Every app shows you data.<br /><span className="pw-gradient-text">We tell you what to do.</span>
            </h1>
            <p className="mt-6 text-lg text-white/70 leading-relaxed max-w-xl">
              Your salary, investments, loans, insurance and tax — one score, one clear plan, with exact rupee steps.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href="/login" className="pw-shimmer-cta rounded-full text-pine-950 px-8 py-4 font-bold shadow-lg shadow-mint-500/20 hover:scale-[1.03] transition-transform">Get your free score →</Link>
              <span className="text-sm text-white/50">No card · 2 minutes · cancel anytime</span>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-white/45">
              {['RBI Account Aggregator', 'SEBI-compliant education', 'DPDP-ready', 'Bank-grade encryption'].map((t) => (
                <span key={t} className="flex items-center gap-1.5"><span className="text-mint-400">✓</span>{t}</span>
              ))}
            </div>
          </div>

          {/* 3D tilt score card */}
          <div className="hidden lg:flex justify-end pw-reveal" style={{ perspective: '1200px' }}>
            <div
              ref={cardRef}
              onMouseMove={onMove}
              onMouseLeave={() => setTilt({ x: 0, y: 0 })}
              style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transition: 'transform .2s ease-out' }}
              className="bg-white rounded-3xl p-8 text-ink shadow-2xl w-[360px]"
            >
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs font-bold uppercase tracking-widest text-ink-faint">Your dashboard</span>
                <span className="chip bg-mint-100 text-pine-700">+6 this month</span>
              </div>
              <div className="flex justify-center"><Gauge score={78} /></div>
              <div className="mt-5 space-y-3">
                {[['Savings rate', 88], ['Insurance', 54], ['Tax efficiency', 61]].map(([l, v]) => (
                  <div key={l as string}>
                    <div className="flex justify-between text-xs font-semibold mb-1"><span>{l}</span><span className="tabular-nums">{v as number}</span></div>
                    <div className="h-1.5 bg-paper-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${v}%`, background: 'linear-gradient(90deg,#0F3D34,#2FBC9B)' }} /></div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-xl bg-paper p-4 text-xs leading-relaxed">
                <span className="font-bold text-pine-800">Next:</span> add ₹75L term cover — protects the mortgage. <span className="text-signal-teal font-semibold">+8 pts</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value pillars */}
      <section className="bg-paper text-ink py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PILLARS.map((p, i) => (
              <div key={p.title} className="card p-6 pw-reveal hover:shadow-lift transition-shadow" style={{ transitionDelay: `${i * 60}ms` }}>
                <span className="inline-flex w-11 h-11 items-center justify-center rounded-xl bg-gradient-to-br from-pine-900 to-pine-700 text-mint-300">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d={p.icon} /></svg>
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-pine-900">{p.title}</h3>
                <p className="mt-1.5 text-sm text-ink-soft leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature showcase */}
      <section id="features" className="bg-pine-950 py-24 relative overflow-hidden">
        <div className="absolute -z-0 top-1/3 -right-20 w-96 h-96 rounded-full bg-mint-500/10 blur-3xl pw-blob" />
        <div className="max-w-6xl mx-auto px-6 relative">
          <div className="text-center max-w-2xl mx-auto mb-16 pw-reveal">
            <p className="text-mint-300 text-sm font-semibold tracking-[0.2em] uppercase mb-3">What you get</p>
            <h2 className="font-display text-4xl sm:text-5xl font-medium leading-tight">A full finance team,<br />in one app.</h2>
          </div>
          <div className="space-y-6">
            {FEATURES.map((f, i) => (
              <div key={f.tag} className={`pw-reveal grid md:grid-cols-2 gap-8 items-center pw-glass rounded-3xl p-8 ${i % 2 ? 'md:[direction:rtl]' : ''}`}>
                <div className="[direction:ltr]">
                  <p className="text-mint-300 text-xs font-semibold tracking-[0.2em] uppercase mb-3">{f.tag}</p>
                  <h3 className="font-display text-3xl font-medium leading-tight">{f.title}</h3>
                  <p className="mt-3 text-white/65 leading-relaxed max-w-md">{f.body}</p>
                </div>
                <div className="[direction:ltr] flex items-center justify-center min-h-[150px]"><FeatureVisual kind={f.visual} /></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Urgency — cost of waiting */}
      <section id="value" className="bg-paper text-ink py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12 pw-reveal">
            <p className="text-signal-teal text-sm font-semibold tracking-[0.2em] uppercase mb-3">The cost of waiting</p>
            <h2 className="font-display text-4xl sm:text-5xl font-medium">Every month you wait<br />has a price.</h2>
          </div>
          <div className="card p-8 sm:p-10 pw-reveal">
            <div className="flex items-center justify-between text-sm font-semibold text-ink-soft">
              <span>If you invest</span>
              <span className="font-display text-2xl text-pine-900 tabular-nums">{inrCompact(monthly)}<span className="text-sm text-ink-faint font-normal">/mo</span></span>
            </div>
            <input type="range" min={2000} max={75000} step={1000} value={monthly} onChange={(e) => setMonthly(Number(e.target.value))}
              className="w-full mt-3 accent-mint-500 h-2 cursor-pointer" />
            <div className="grid sm:grid-cols-2 gap-5 mt-8">
              <div className="rounded-2xl bg-paper-100 p-6">
                <p className="text-xs uppercase tracking-widest text-ink-faint font-bold">Drifting along</p>
                <p className="font-display text-3xl font-semibold mt-2 tabular-nums text-ink">{inrCompact(doNothing)}</p>
                <p className="text-xs text-ink-faint mt-1">in 10 years, idle savings</p>
              </div>
              <div className="rounded-2xl p-6 text-white" style={{ background: 'linear-gradient(135deg,#0F3D34,#177a67)' }}>
                <p className="text-xs uppercase tracking-widest text-mint-300 font-bold">With PayWatch</p>
                <p className="font-display text-3xl font-semibold mt-2 tabular-nums">{inrCompact(withPW)}</p>
                <p className="text-xs text-white/60 mt-1">disciplined, stepped-up, diversified</p>
              </div>
            </div>
            <div className="mt-6 text-center">
              <p className="text-sm text-ink-soft">That&apos;s a</p>
              <p className="font-display text-4xl font-semibold pw-gradient-text tabular-nums">{inrCompact(gap)} difference</p>
              <p className="text-[11px] text-ink-faint mt-2 max-w-lg mx-auto leading-relaxed">Illustrative, nominal, not a guarantee of returns. Assumes ~3.5% idle vs ~11% diversified with a 10% annual step-up. Markets carry risk.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-pine-950 py-20">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { v: <CountUp to={6} suffix="" />, l: 'income heads computed' },
            { v: <CountUp to={100} suffix="" />, l: 'point money score' },
            { v: <><CountUp to={18} />+</>, l: 'features, one app' },
            { v: <>₹<CountUp to={299} /></>, l: 'to start, per month' },
          ].map((s, i) => (
            <div key={i} className="pw-reveal" style={{ transitionDelay: `${i * 60}ms` }}>
              <p className="font-display text-4xl sm:text-5xl font-semibold pw-gradient-text tabular-nums">{s.v}</p>
              <p className="text-xs text-white/50 mt-2 uppercase tracking-wider">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-paper text-ink py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14 pw-reveal">
            <h2 className="font-display text-4xl sm:text-5xl font-medium">Less than your streaming.</h2>
            <p className="text-ink-soft mt-3">All prices include 18% GST. Annual: 12 months for the price of 10.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 items-start">
            {[
              { name: 'Starter', price: '₹299', tag: 'Get organised', feats: ['Full Money Health Score', '3 actions / month', '5 CFO questions / month', 'Basic tax view'] },
              { name: 'CFO', price: '₹699', tag: 'Most popular', hl: true, feats: ['Unlimited actions & questions', 'Full tax engine', 'Complete insurance analysis', 'Quarterly advisor call'] },
              { name: 'Family', price: '₹1,199', tag: 'Up to 4 members', feats: ['Everything in CFO, per member', 'Family net worth', 'Estate & nomination checklist', 'Longer advisor call'] },
            ].map((p) => (
              <div key={p.name} className={`p-8 pw-reveal rounded-2xl ${p.hl ? 'text-white shadow-2xl scale-[1.02]' : 'card'}`} style={p.hl ? { background: 'linear-gradient(160deg,#0F3D34,#134e43)' } : {}}>
                {p.hl && <span className="chip bg-mint-500 text-pine-950 mb-3">Most popular</span>}
                <h3 className="text-lg font-bold">{p.name}</h3>
                <p className={`text-xs ${p.hl ? 'text-white/60' : 'text-ink-faint'}`}>{p.tag}</p>
                <p className="mt-4"><span className="font-display text-4xl font-semibold">{p.price}</span><span className={`text-sm ${p.hl ? 'text-white/50' : 'text-ink-faint'}`}>/month</span></p>
                <ul className={`mt-6 space-y-2.5 text-sm ${p.hl ? 'text-white/85' : 'text-ink-soft'}`}>
                  {p.feats.map((f) => <li key={f} className="flex gap-2"><span className="text-mint-400 font-bold">✓</span>{f}</li>)}
                </ul>
                <Link href="/login" className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-bold transition-colors ${p.hl ? 'bg-mint-500 text-pine-950 hover:bg-mint-400' : 'bg-pine-900 text-white hover:bg-pine-800'}`}>Start {p.name}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-pine-950 py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="relative rounded-3xl p-12 sm:p-16 text-center overflow-hidden pw-reveal" style={{ background: 'linear-gradient(135deg,#0F3D34 0%,#177a67 60%,#2FBC9B 130%)' }}>
            <div className="absolute -top-16 -right-10 w-72 h-72 rounded-full bg-white/10 blur-3xl pw-blob" />
            <h2 className="font-display text-4xl sm:text-5xl font-medium relative">Know your number.<br />Get your plan. Free.</h2>
            <p className="mt-4 text-white/70 relative">Two minutes. No card. See exactly what to fix first.</p>
            <Link href="/login" className="relative inline-flex mt-8 rounded-full bg-white text-pine-950 px-9 py-4 font-bold hover:bg-mint-100 transition-colors shadow-xl">Get your free score →</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-pine-950 text-white/50 text-xs border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-12 grid md:grid-cols-2 gap-8">
          <div>
            <LogoMark size={28} />
            <p className="mt-4 max-w-md leading-relaxed">
              PayWatch · Bengaluru, India. Financial education and organisation platform. Not a SEBI-registered
              Investment Adviser — we do not recommend specific securities. Your data is encrypted and never sold.
            </p>
          </div>
          <div className="flex gap-12 md:justify-end">
            <div className="space-y-2 flex flex-col">
              <span className="text-white/80 font-semibold mb-1">Legal</span>
              <Link href="/legal/terms" className="hover:text-white">Terms of Service</Link>
              <Link href="/legal/privacy" className="hover:text-white">Privacy Policy</Link>
              <Link href="/legal/disclosures" className="hover:text-white">Regulatory Disclosures</Link>
            </div>
            <div className="space-y-2 flex flex-col">
              <span className="text-white/80 font-semibold mb-1">Contact</span>
              <a href="mailto:support@paywatch.in" className="hover:text-white">support@paywatch.in</a>
              <a href="mailto:grievance@paywatch.in" className="hover:text-white">Grievance officer</a>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center">© {new Date().getFullYear()} PayWatch Technologies Pvt. Ltd.</div>
      </footer>
    </main>
  );
}
