import Link from 'next/link';
import { Wordmark, LogoMark } from '@/components/Logo';

export default function Landing() {
  return (
    <main className="min-h-screen bg-pine-950 text-white">
      {/* Nav */}
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <Wordmark dark />
        <nav className="flex items-center gap-6 text-sm text-white/70">
          <a href="#how" className="hover:text-white transition-colors hidden sm:block">How it works</a>
          <a href="#pricing" className="hover:text-white transition-colors hidden sm:block">Pricing</a>
          <Link href="/legal/disclosures" className="hover:text-white transition-colors hidden md:block">Disclosures</Link>
          <Link href="/login" className="rounded-full bg-white text-pine-950 px-5 py-2.5 font-semibold hover:bg-mint-100 transition-colors">
            Sign in
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-24 grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <p className="text-mint-400 text-sm font-semibold tracking-[0.2em] uppercase mb-6">India&apos;s personal finance operating system</p>
          <h1 className="font-display text-5xl sm:text-6xl leading-[1.05] font-medium">
            Every app shows you data.<br />
            <em className="text-mint-300">We tell you what to do.</em>
          </h1>
          <p className="mt-6 text-lg text-white/70 leading-relaxed max-w-xl">
            Personal CFO consolidates your salary, investments, loans, insurance and taxes into one
            Money Health Score — then gives you a prioritised action plan with exact amounts,
            deadlines and the rupee impact of each step.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/login" className="rounded-full bg-mint-500 text-pine-950 px-8 py-4 font-bold hover:bg-mint-400 transition-colors">
              Get your score — free
            </Link>
            <span className="text-sm text-white/50">Plans from ₹299/month · cancel anytime</span>
          </div>
          <p className="mt-8 text-xs text-white/40 max-w-lg leading-relaxed">
            Personal CFO is a financial education and organisation tool, not a SEBI-registered investment
            adviser. We never recommend specific stocks or schemes, and we never see your bank credentials.
          </p>
        </div>

        {/* Score preview card */}
        <div className="hidden lg:block">
          <div className="bg-white rounded-3xl p-8 text-ink shadow-2xl max-w-sm ml-auto rotate-1">
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-bold uppercase tracking-widest text-ink-faint">Money Health Score</span>
              <span className="chip bg-mint-100 text-pine-700">+6 this month</span>
            </div>
            <div className="text-center">
              <span className="font-display text-7xl font-semibold text-signal-teal">72</span>
              <p className="text-xs text-ink-faint mt-1 uppercase tracking-widest">out of 100</p>
            </div>
            <div className="mt-8 space-y-4">
              {[
                ['Savings rate', 88, '#2E9E44'],
                ['Insurance adequacy', 54, '#C77E1F'],
                ['Tax efficiency', 61, '#C77E1F'],
              ].map(([label, val, color]) => (
                <div key={label as string}>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>{label}</span><span style={{ color: color as string }}>{val}</span>
                  </div>
                  <div className="h-1.5 bg-paper-100 rounded-full">
                    <div className="h-full rounded-full" style={{ width: `${val}%`, background: color as string }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 rounded-xl bg-paper p-4 text-xs leading-relaxed">
              <span className="font-bold text-pine-800">Next action:</span> Increase term cover by ₹75L —
              protects your family&apos;s mortgage. <span className="text-signal-teal font-semibold">+8 pts</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-paper text-ink py-24">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-display text-4xl font-medium text-center">One number. Six dimensions.<br />A plan that moves it.</h2>
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            {[
              ['01 — Connect', 'Link accounts via the RBI-regulated Account Aggregator framework, or enter details manually. We never ask for bank passwords — consent is granular, time-bound and revocable.'],
              ['02 — Understand', 'Your Money Health Score quantifies savings, insurance, diversification, emergency readiness, debt and tax efficiency — benchmarked against planning standards, not opinions.'],
              ['03 — Act', 'A prioritised action list with exact rupee amounts and deadlines. Complete an action, watch your score move. Ask your CFO anything — answers grounded in your own numbers.'],
            ].map(([title, body]) => (
              <div key={title} className="card p-8">
                <h3 className="font-display text-xl font-semibold text-pine-800">{title}</h3>
                <p className="mt-4 text-sm text-ink-soft leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-paper text-ink pb-24">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-display text-4xl font-medium text-center mb-4">Less than your streaming subscriptions.</h2>
          <p className="text-center text-ink-soft mb-16">All prices include 18% GST. Annual plans: 12 months for the price of 10.</p>
          <div className="grid md:grid-cols-3 gap-8 items-start">
            {[
              { name: 'Starter', price: '₹299', tag: 'Get organised', feats: ['Full Money Health Score', '3 actions per month', '5 CFO questions/month', '2 goals · basic tax view', 'Data export anytime'] },
              { name: 'CFO', price: '₹699', tag: 'Most popular', hl: true, feats: ['Unlimited actions & questions', 'Full tax engine — all sections', 'Complete insurance analysis', 'Human-reviewed AI answers', 'Quarterly advisor call (30 min)'] },
              { name: 'Family', price: '₹1,199', tag: 'Up to 4 members', feats: ['Everything in CFO — per member', 'Consolidated family net worth', 'Family insurance overview', 'Estate & nomination checklist', 'Quarterly advisor call (45 min)'] },
            ].map((p) => (
              <div key={p.name} className={`card p-8 ${p.hl ? 'ring-2 ring-pine-700 relative' : ''}`}>
                {p.hl && <span className="absolute -top-3 left-8 chip bg-pine-900 text-white">Most popular</span>}
                <h3 className="text-lg font-bold">{p.name}</h3>
                <p className="text-xs text-ink-faint">{p.tag}</p>
                <p className="mt-4"><span className="font-display text-4xl font-semibold">{p.price}</span><span className="text-sm text-ink-faint">/month</span></p>
                <ul className="mt-6 space-y-2.5 text-sm text-ink-soft">
                  {p.feats.map((f) => (
                    <li key={f} className="flex gap-2"><span className="text-mint-500 font-bold">·</span>{f}</li>
                  ))}
                </ul>
                <Link href="/login" className={`mt-8 w-full ${p.hl ? 'btn-primary' : 'btn-secondary'}`}>Start with {p.name}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-pine-950 text-white/50 text-xs">
        <div className="max-w-6xl mx-auto px-6 py-12 grid md:grid-cols-2 gap-8">
          <div>
            <LogoMark size={28} />
            <p className="mt-4 max-w-md leading-relaxed">
              Personal CFO Technologies Pvt. Ltd. · Bengaluru, India. Financial education and organisation
              platform. Not a SEBI-registered Investment Adviser — we do not recommend specific securities.
              Data secured with AES-256 encryption, stored in India (AWS ap-south-1), never sold or shared
              without your explicit consent.
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
              <a href="mailto:support@personalcfo.in" className="hover:text-white">support@personalcfo.in</a>
              <a href="mailto:grievance@personalcfo.in" className="hover:text-white">Grievance officer</a>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center">© {new Date().getFullYear()} Personal CFO Technologies Pvt. Ltd.</div>
      </footer>
    </main>
  );
}
