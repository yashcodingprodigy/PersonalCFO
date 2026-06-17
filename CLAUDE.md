# PayWatch — Project Context & Long-Term Memory

> Single source of truth for the PayWatch project. Read this first before working on the codebase.
> Keep it updated when architecture, features, deployment, branding, or compliance decisions change.

Last updated: June 2026.

---

## 1. What PayWatch is

PayWatch (formerly "Personal CFO") is **India's personal-finance operating system** — one app that
knows a user's full financial picture (income, spending, savings, investments, loans, insurance, taxes)
and tells them exactly what to do next, in beginner-friendly language. The ambition: **replace the work
of a CA + a personal CFO for individual taxpayers.**

**Positioning / value ladder:**
- One-time hook (free/cheap): Money Health Score + "what to invest in" plan.
- Subscription (the recurring value): proactive Alerts, monthly briefing, year-round Tax Copilot,
  guided ITR filing, spending watchdog, goal autopilot, document vault.

**Regulatory lane (critical — never drift):** PayWatch is a **financial education, organisation and
tax-preparation** tool. It is **NOT** a SEBI-registered Investment Adviser and never recommends a
specific stock, mutual-fund scheme or product — only asset-class / fund-**category** guidance. For tax
it *prepares and computes* returns and guides self-filing; it is not a CA. See §8 for the legal limits
(ERI for one-click e-filing; audits/certifications legally need a CA).

---

## 2. Architecture

```
PayWatch/
├── server/   Express + TypeScript API · PostgreSQL · port 4000
└── web/      Next.js 14 (App Router) PWA + Capacitor (Android/iOS) · Tailwind · port 3000
```

- **Money stored in paise everywhere** (₹1 = 100 paise). Web `inr()` formats paise → ₹.
- **Auth:** mobile OTP (+91), JWT 15-min access + 90-day rotating refresh. Tokens in `localStorage`
  (`paywatch_access` / `paywatch_refresh`). OTP is **never** returned to the client — read from Railway
  logs in dev (`424242` when `NODE_ENV!=production`; random in prod), or SMS via msg91.
- **Audiences:** working professionals AND **students (~19–23)**. `employment_type` includes `'student'`.
  Onboarding, score, insurance, tax and actions all adapt for students (no life-insurance pressure, no
  tax pressure below threshold, "start investing small / index funds before stocks").

---

## 3. Feature map (every tab)

Web app tabs live in `web/src/app/(app)/<tab>/page.tsx`, behind the auth layout (sidebar + mobile nav,
unread-alerts badge, native biometric lock overlay).

- **Overview** (`dashboard`) — Money Health Score gauge + 6 dimensions, monthly **briefing** card,
  **net-worth growth** comparison (do-nothing vs with-PayWatch, 5/10/20yr toggle, step-up SIP), net
  worth summary, top actions, AA connect.
- **Alerts** (`alerts`) — proactive inbox (urgent/warning/info/good), mark read/dismiss.
- **Actions** (`actions`) — quantified action plan; **priority** badges + filters (status/priority/sort);
  "Mark done" → confirmation → optional "how much / into what" → writes to profile + recalcs score.
- **Net worth** (`networth`) — allocation **donut**, assets/liabilities, growth projection w/ horizon
  toggle, spending breakdown.
- **Invest** (`invest`) — SEBI-compliant: risk profile, target-mix donut, collapsible fund-category
  recommendations, model portfolios, start steps. Section nav.
- **Markets & news** (`markets`) — educational investment themes + live financial news (keyless RSS).
- **Tax** (`tax`) — regime comparison, "how to reduce your tax" (collapsible steps), **Tax Copilot**
  (advance-tax timeline, proof calendar, harvesting, CA-ready pack), deduction tracker, calendar,
  docs + glossary. Section nav.
- **File ITR** (`file`) — guided wizard (Income → Deductions → Tax paid → Result): computes the full
  return, picks the ITR form, refund/payable, full computation, "how to file yourself" portal steps,
  downloadable computation pack. Links to rent receipts.
- **Insurance** (`insurance`) — coverage **rings**, collapsible "what to get" recommendations, avoid list.
- **Statement scan** (`statement`) — client-side CSV/Excel/PDF parse → detailed spending report.
- **Document vault** (`vault`) — track CA paperwork + expiry reminders (feeds alerts).
- **Rent receipts** (`rent-receipts`) — generate a year of HRA receipts, print/PDF (not in nav; linked).
- **Goals**, **Ask your CFO** (RAG Q&A), **Reports**, **Plans** (pricing/subscribe), **Settings**.
- Public: `onboarding` (3-session, state→city dropdowns, risk question), `login`, landing `/`, `legal/*`.

---

## 4. Server (`server/src`)

- `index.ts` — app, CORS (web origins + `capacitor://localhost` / `localhost` for the native app),
  route mounting, `/v1/health`.
- `config.ts` — env config (DB, JWT, SMS/billing/AA, ANTHROPIC, EMAIL, CRON_SECRET, FCM, APP_URL).
- `db/schema.sql` — **idempotent** schema (CREATE IF NOT EXISTS, ALTER ADD COLUMN IF NOT EXISTS,
  constraint drop+re-add). `db/migrate.ts` (dev/tsx) and compiled `dist/db/migrate.js` (prod) run it.

### Services
- `score.ts` — Money Health Score: 6 weighted dimensions (savings 25 / insurance 20 / diversification 20
  / emergency 15 / debt 10 / tax 10); unavailable dims excluded + renormalised. Student/young-aware:
  insurance excluded for students & no life-cover needed when `dependents===0`; tax-efficiency excluded
  below ~₹12.75L income.
- `tax.ts` — FY2025-26 old vs new regime, deductions, HRA, `taxReductionPlan()` (beginner steps + rupee
  impact + capital-gains explainer + checklist + glossary), `taxCopilot()` (advance-tax schedule, proof
  checklist, harvesting, CA-ready pack), `marginalRate()`, `computeHraExemption()`.
- `taxFiling.ts` — **ITR engine**: `prepareFiling()` picks ITR-1/2/3/4, computes full return across all
  heads (salary, interest, house property, equity STCG 20% / LTCG 12.5% over ₹1.25L, other, business),
  both regimes incl. rebate/surcharge/cess, reconciles TDS + advance tax → refund/payable, flags rare
  audit-needs-CA case, outputs checklist + portal walkthrough.
- `insurance.ts` — 25× term rule (no life cover without dependents), health sizing, personalised
  "what to get" + "what to avoid". Student-aware.
- `investment.ts` — SEBI-compliant guidance: risk profile, target allocation, fund-**category**
  recommendations, model portfolios, monthly SIP plan. Never names a product.
- `statement.ts` — bank-statement analyser (category breakdown, invested total, recurring subs, reduce
  suggestions, watch-outs).
- `networth.ts` — asset/liability breakdown, allocation, `growthProjection()` (5/10/20yr, step-up SIP).
- `actions.ts` — rule engine ACT-001…ACT-021, each with computed `priority`.
- `market.ts` — educational themes + live news via keyless Google News RSS (fails soft).
- `alerts.ts` — alert generators; `monitor.ts` — shared regenerate/gatherSignals (used by route + cron).
- `goals.ts`, `cfo-ai.ts` (RAG Q&A), `rag.ts` (Postgres FTS), `profile.ts` (load ProfileData + recalc).

### Adapters
`sms.ts` (dev logs / msg91), `aa.ts` (Account Aggregator mock / Finvu), `billing.ts` (sandbox /
Razorpay), `email.ts` (dev logs / Resend + digest template), `push.ts` (FCM integration point — log
mode until firebase-admin wired).

### Routes
`auth`, `user` (+ `/push-token`), `score`, `actions` (+ `/:id/complete`), `insights` (mounts `/networth`
`/tax` `/tax/filing/prefill` `/tax/filing/compute` `/insurance` `/invest` `/market` `/statements/analyze`
`/transactions` `/spend`), `goals`, `qa`, `billing`, `compliance`, `aa`, `reports`, `alerts`
(`/` `/count` `/run` `/:id/read` `/read-all` `/:id`(dismiss) `/briefing`), `documents`, `cron` (`/run`,
secret-protected — NOT requireAuth).

### DB tables
`users`(+state,risk_appetite,email), `otp_codes`, `refresh_tokens`, `profiles`, `score_history`,
`actions`(+priority), `goals`, `transactions`, `conversations`, `messages`, `rag_documents`,
`subscriptions`, `invoices`, `consents`, `notifications`(+emailed_at, unique on user_id+dedupe_key),
`documents`, `device_tokens`, `audit_log`.

---

## 5. Web (`web/src`)
- `lib/api.ts` (fetch + token refresh), `lib/format.ts` (`inr()`), `lib/india.ts` (states→cities, metro),
  `lib/statementParse.ts` (client CSV/XLSX/PDF parse via cdnjs), `lib/native.ts` (Capacitor bridge).
- `components/kit.tsx` — shared UI: `Donut`, `Ring`, `StackedBar`, `Disclosure`, `SectionNav`, `Section`,
  `StatTile`, `Pill`, `TopicIcon`, colours. `Logo.tsx` (Wordmark "Pay*Watch*"), `ScoreGauge`,
  `UpgradeBanner` (soft paywall), `AuthRedirect` (resume session on app open).

---

## 6. Mobile apps (Capacitor) — see `web/MOBILE.md`
- Bundled **static export** (`BUILD_TARGET=mobile next build` → `web/out/`), `capacitor.config.ts`
  (appId `in.paywatch.app`). Scripts: `build:mobile` / `cap:sync` / `cap:ios` / `cap:android` / `cap:assets`.
- `lib/native.ts`: biometric app-lock (launch/resume), splash, status bar, haptics, push registration →
  `POST /user/push-token`. All no-op on web (same codebase on Vercel + native).
- **Push is gated off by `NEXT_PUBLIC_PUSH_ENABLED=1`** (build-time) — without Firebase set up it crashes
  Android, so it stays off until `firebase-admin` + google-services.json/APNs are done.
- Icons/splash source in `web/assets/` → `npm run cap:assets`. Run `npx cap add ios/android` locally
  (Mac + CocoaPods for iOS). Both stores need an **org account + D-U-N-S** (finance category).

---

## 7. Deployment
- **Source:** GitHub `yashcodingprodigy/PersonalCFO`, branch `main`. Push → auto-deploys.
- **API:** Railway service "PersonalCFO" (built from `server/`). **Pre-Deploy = `npm run migrate:prod`**
  (compiled, idempotent; `build` copies `schema.sql` into `dist/db/`) → no manual migrations for additive
  changes. Start = `node dist/index.js`.
- **DB:** Railway Postgres (`DATABASE_URL` injected).
- **Web:** Vercel (from `web/`). `NEXT_PUBLIC_API_URL` baked at build → redeploy on change.
- **Domain:** `paywatch.in` (GoDaddy). Apex `A @ → 76.76.21.21` (Vercel), `CNAME www → cname.vercel-dns.com`.
  **`api.paywatch.in`** = Railway custom domain (`CNAME api → <railway target>` + `TXT _railway-verify.api`).
  Leave GoDaddy email records (MX/SPF/DKIM/DMARC) intact. `NEXT_PUBLIC_API_URL = https://api.paywatch.in/v1`.
- **CORS:** server allows `CORS_ORIGIN` (comma list: `https://paywatch.in,https://www.paywatch.in`) +
  native origins (`capacitor://localhost`, `http(s)://localhost`) automatically.
- **Proactive cron:** `POST /v1/cron/run` header `x-cron-key: $CRON_SECRET` → regenerates alerts for all
  users, emails (Resend) + pushes digests; each alert sent once (`emailed_at`). Wire a Railway cron.
  Disabled until `CRON_SECRET` set.
- **Env vars:** Railway → `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`,
  `NODE_ENV=production`, `SMS_PROVIDER`, `BILLING_PROVIDER`, `AA_PROVIDER`, `ANTHROPIC_API_KEY`(opt),
  `CRON_SECRET`, `EMAIL_PROVIDER`(dev/resend)+`RESEND_API_KEY`+`EMAIL_FROM`, `APP_URL`, `FCM_SERVER_KEY`(opt).
  Vercel → `NEXT_PUBLIC_API_URL` (+ `NEXT_PUBLIC_PUSH_ENABLED=1` only for mobile builds once Firebase ready).

### Reset DB (keeps seeded knowledge base)
```sql
DELETE FROM users; DELETE FROM otp_codes; DELETE FROM audit_log;
```
Total wipe: also `DELETE FROM rag_documents;` then `DATABASE_URL=… npm run seed`.

### Common gotchas
- "Failed to fetch" on login = CORS or `NEXT_PUBLIC_API_URL` (NOT DNS). Fix env + redeploy Vercel.
- Native app "failed to fetch" = API unreachable (use the working HTTPS URL) or CORS change not deployed.
- Non-additive DB changes (drop/rename/type) aren't handled by the idempotent re-run — run SQL by hand.

---

## 8. Compliance posture (India) & legal limits
- **SEBI:** education/organisation only; never name a security; no real-time tips (finfluencer rule:
  no <3-month price data beside a named security — PayWatch names none). Paid specific advice → SEBI RIA.
- **Tax / ITR — the CA-replacement boundary:**
  - PayWatch can legally **prepare, compute and guide self-filing** of ITRs for individuals — no licence
    needed. This already removes the CA for most salaried/individual taxpayers.
  - **One-click e-filing from inside the app needs ERI (e-Return Intermediary) registration** with the
    Income Tax Dept (like ClearTax/Quicko). Until then users self-file on the portal using our computation.
  - **Tax audits (44AB) + certain certifications (e.g. 15CB)** legally require a CA's signature/UDIN —
    software cannot remove these (affects larger businesses, not regular individuals). Engine flags this.
- **DPDP Act 2023 + Rules 2025** (notified 13 Nov 2025, ~18-month phased): PayWatch is a Data Fiduciary.
  Built: consent ledger, JSON export, hard delete, AA revocation, audit log. To formalise: standalone
  consent notice, breach process, grievance officer, under-18 parental consent, security docs.
- **RBI Account Aggregator:** live bank data needs **FIU** registration (Sahamati + Finvu). Keep
  `AA_PROVIDER=mock` + statement-upload until then.
- **Payments:** Razorpay is the PA; PayWatch is a merchant (needs Razorpay KYC, not a PA licence).

---

## 9. Roadmap / long-term goals

### Done ✓
- Full app feature set (§3), recurring-value engine (alerts/briefing/copilot/watchdog/autopilot/vault),
  plans/soft-paywall, email+cron delivery, **mobile (Capacitor) scaffolded**, **guided ITR filing wizard**,
  **rent-receipt generator**, `api.paywatch.in` custom domain.

### Software still to build (legal now, no registration needed)
1. **Form 16 / 26AS / AIS auto-import & reconciliation** — upload Form 16 PDF / AIS JSON → auto-fill the
   filing wizard instead of typing (best-effort PDF parse exists for statements; extend for Form 16).
2. **Capital-gains statement importer** — broker P&L CSV → auto STCG/LTCG into the wizard.
3. **More CA document generators** — printable computation sheet (PDF), 80G/donation receipts,
   net-worth statement. (Rent receipts done.)
4. **GST suite** for business users — GSTR-1/3B preparation/summaries.
5. **Firebase push delivery** — finish `adapters/push.ts` with `firebase-admin`; flip `NEXT_PUBLIC_PUSH_ENABLED=1`.
6. **Hard paywall enforcement** — gate premium endpoints/features server-side for non-CFO plans (currently soft banners).

### Business / legal / registrations (Goal B — needs professionals)
1. **Company** — incorporate Pvt Ltd, PAN/TAN (CA/CS). Update legal copy CIN/address.
2. **Trademark** "PayWatch" with IP India (classes 9 / 36 / 42).
3. **GST registration** (billing already issues 18% GST invoices).
4. **DPDP baseline** — consent notice, grievance officer, breach plan, under-18, security docs (lawyer).
5. **Developer accounts + D-U-N-S** — Apple ($99/yr) + Google ($25) org accounts; start D-U-N-S early.
6. **ERI registration** (Income Tax Dept) — unlocks true one-click e-filing from the app.
7. **Razorpay live KYC** — for live subscriptions.
8. **AA / FIU** (Sahamati + Finvu) — only when moving off mock bank data.
9. **Legal review** — Terms / Privacy / Disclosures + the SEBI & tax boundaries.

> NONE of §8–9 is legal advice. Engage a CA (entity, GST, audit, ERI) and a lawyer (DPDP, SEBI/tax
> boundary, terms). Verify every rule against the current official source before acting.

---

## 10. Working agreements
- Owner prefers concise, direct answers; owner is new to dev/ops — explain "where to run" things.
- For deployed changes, always call out DB-migration and env-var implications before they go live.
- Keep every money feature inside the education/organisation lane; tax features stay "prepare + guide
  self-file"; add disclaimers on new surfaces.
- Verify with `cd server && npx tsc --noEmit` and `cd web && npx tsc --noEmit` after changes.
