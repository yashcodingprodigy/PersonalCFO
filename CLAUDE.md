# PayWatch — Project Context & Long-Term Memory

> Single source of truth for the PayWatch project. Read this first before working on the codebase.
> Keep it updated when architecture, features, deployment, branding, or compliance decisions change.

Last updated: June 2026 (CA portal, Portfolio X-ray, Ask PayWatch rename, Supabase Mumbai DB).

---

## 1. What PayWatch is

PayWatch (formerly "Personal CFO") is **India's personal-finance operating system** — one app that
knows a user's full financial picture (income, spending, savings, investments, loans, insurance, taxes)
and tells them exactly what to do next, in beginner-friendly language. The hero feature is **Ask your
CFO** — an AI advisor grounded in the user's own numbers (surfaced front-and-centre in nav + dashboard +
landing).

**Positioning on CAs (important — do NOT drift back to "replace your CA"):** PayWatch is an always-on
financial **CFO** that **works alongside** the user's Chartered Accountant and advisor — it never claims
to replace them. We give individuals a private CFO for everyday money decisions AND make a CA's job faster
(CA-ready packs, computed returns, organised documents). Audits/certifications still legally need a CA
(see §8). Framing: "helps your CA now, may reduce the need over time" — never "no CA needed".

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

- **Overview** (`dashboard`) — **Ask PayWatch spotlight** card (suggested Qs deep-link to `/ask?q=`),
  Money Health Score gauge + 6 dimensions, monthly **briefing** card, **net-worth growth** comparison
  (do-nothing vs with-PayWatch, 5/10/20yr toggle, **risk selector** that re-projects, step-up SIP,
  honest disclaimer), net worth summary, top actions, "Upload bank statement" CTA (AA bank-sync is
  "coming soon"). Data fetched via the **SWR cache** (`lib/api swr()`).
- **Alerts** (`alerts`) — proactive inbox (urgent/warning/info/good), mark read/dismiss.
- **Actions** (`actions`) — quantified action plan; **priority** badges + filters (status/priority/sort);
  "Mark done" → confirmation → optional "how much / into what" → writes to profile + recalcs score.
- **Net worth** (`networth`) — allocation **donut**, assets/liabilities, growth projection w/ horizon
  toggle, spending breakdown.
- **Invest** (`invest`) — SEBI-compliant: risk profile, target-mix donut, collapsible fund-category
  recommendations (each with **"I've started this → add to my data"** which bumps SIP + hides it),
  approximate amounts (`inrApprox`), **Portfolio X-ray** section (upload holdings → look-through), model
  portfolios, start steps. Section nav. (`/portfolio` route now redirects here.)
- **Your CA** (`advisor`) — connect to a Chartered Accountant: your connect code, enter a CA code,
  approve/decline requests, disconnect. Active CA → `/advisor/[id]` (messaging + document sharing). See §11.
- **Markets & news** (`markets`) — **news first**, then educational investment themes (keyless RSS).
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
- **Goals** (moved up in nav; shows a dummy **Example** goal when empty), **Ask PayWatch** (`ask`, RAG
  Q&A — renamed from "Ask your CFO"; can **create goals from chat**; topical scope guard rejects
  off-topic/abuse), **Reports**, **Plans** (pricing/subscribe), **Settings** (+ Vehicle asset field).
- Public: `onboarding` (3-session, state→city dropdowns, risk question), `login` (+ **User/CA toggle**),
  landing `/`, `legal/*`. **CA portal** is separate: `/ca/login`, `/ca` (home), `/ca/client/[id]`.

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
  recommendations, model portfolios, monthly SIP plan. Returns `takeHome/monthlyExpenses/currentSip/surplus`
  for the clean plan card; hides categories in `assets.invest_started`. Never names a product.
- `holdings.ts` — **Portfolio X-ray look-through**: `analyzeHoldings()` classifies each holding (asset
  class, equity market-cap, sector for direct stocks via a built-in map) and scores true diversification
  (grade + flags). Educational only.
- `statement.ts` — bank-statement analyser. Import is **de-duplicated** by a transaction `fingerprint`
  (sha256 of date+amount+direction+desc) with a partial-unique index; re-uploads skip duplicates.
- `networth.ts` — asset/liability breakdown, allocation, `growthProjection()` — **realistic + risk-based**:
  baseline = current SIP (not full surplus), improved = 25% of take-home (step-up 10%/yr), rates 7/9/11%
  by risk (`conservative/moderate/aggressive`), nominal; returns `riskAppetite` + `assumedReturnPct`.
- `actions.ts` — rule engine ACT-001…ACT-021, each with computed `priority`. Insurance sizing shown as
  rounded ranges (`inrRange`), not false-precise figures.
- `market.ts` — educational themes + live news via keyless Google News RSS (fails soft).
- `alerts.ts` — alert generators; `monitor.ts` — shared regenerate/gatherSignals (used by route + cron).
- `goals.ts`, `cfo-ai.ts` (RAG Q&A — scope guard `checkScope()`, `parseGoalIntent()` for chat goal
  creation, model `claude-sonnet-4`), `rag.ts` (Postgres FTS, **47-doc** seeded KB, incremental seed),
  `profile.ts` (load ProfileData + recalc).
- `caLink.ts` (connect-code gen + `requestLink` handshake), `caShare.ts` (messaging + documents for an
  active link). `db/index.ts` exports **`withTransaction()`** (ACID) — used by statement import + AA refresh.

### Adapters
`sms.ts` (dev logs / msg91), `aa.ts` (Account Aggregator mock / Finvu), `billing.ts` (sandbox /
Razorpay), `email.ts` (dev logs / Resend + digest template), `push.ts` (FCM integration point — log
mode until firebase-admin wired), `storage.ts` (**Supabase Storage** for CA documents — signed URLs;
active when `SUPABASE_URL`+`SUPABASE_SERVICE_KEY` set; supports new `sb_secret_` keys via apikey+Bearer).

### Routes
`auth` (+ exported `verifyOtp`), `user` (+ `/push-token`, **`/ca`** connect-code + links, `/ca/connect`,
`/ca/links/:id/(approve|reject)` + DELETE, `/ca/links/:id/(messages|documents)`), `score`,
`actions` (+ `/:id/complete`), `insights` (mounts `/networth` `/tax` `/tax/filing/*` `/insurance`
`/invest` **`/invest/started`** `/market` `/statements/analyze` **`/holdings/analyze`** `/transactions`
`/spend`), `goals`, `qa`, `billing`, `compliance`, `aa`, `reports`, `alerts`, `documents`, `cron`,
**`ca`** (`/auth/(register|login|token/refresh)`, `/me`, `/clients` connect/approve/reject/delete,
`/clients/:id/(overview|messages|documents)`). CA tokens are JWT `role:'ca'`; `requireCa` guards CA
routes, `requireAuth` rejects CA tokens. JSON body limit raised to 12mb for base64 doc uploads.

### DB tables
`users`(+state,risk_appetite,email,**connect_code**), `otp_codes`, `refresh_tokens`, `profiles`,
`score_history`, `actions`(+priority), `goals`, `transactions`(+**fingerprint**, partial-unique on
user+fingerprint), `conversations`, `messages`, `rag_documents`, `subscriptions`, `invoices`, `consents`,
`notifications`, `documents`, `device_tokens`, `audit_log`, and the **CA portal**: `cas`,
`ca_client_links`(handshake: status pending/active, initiated_by), `ca_messages`, `ca_documents`.

---

## 5. Web (`web/src`)
- `lib/api.ts` (fetch + token refresh + **`swr()` stale-while-revalidate cache**, busted on any write &
  on login/logout), `lib/caApi.ts` (**CA-side client**, separate `paywatch_ca_*` tokens), `lib/format.ts`
  (`inr`, `inrRange`, `inrApprox`), `lib/india.ts`, `lib/statementParse.ts` (client CSV/XLSX/PDF parse +
  `parseHoldingsFile`), `lib/native.ts`.
- `components/kit.tsx` (shared UI), `Logo.tsx` (Wordmark "Pay*Watch*", `plus` badge), `ScoreGauge`,
  `UpgradeBanner`, `AuthRedirect`, `Walkthrough.tsx` (first-run tour), **`PortfolioXray.tsx`** (holdings
  upload + look-through, used inside Invest), **`CaThread.tsx`** (shared messaging + documents panel for
  both CA & user sides; `fileToBase64`).
- Sidebar nav scrolls (`overflow-y-auto min-h-0`) so the account/sign-out footer stays visible.

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
- **DB:** **Supabase Postgres, South-Asia (Mumbai)** for India data residency — set Railway
  `DATABASE_URL` to the **Session pooler** URI (`...pooler.supabase.com:5432`, user `postgres.<ref>`);
  the direct `db.<ref>.supabase.co` host is IPv6-only and fails from Railway. `db/index.ts` enables SSL
  for any non-localhost DB. (The old Railway Postgres is being retired.) Seed: `npm run seed` (KB) and
  `npm run seed:personas` (15 demo users); `npm run check:personas` to verify which DB has them.
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
  `CRON_SECRET`, `EMAIL_PROVIDER`(dev/resend)+`RESEND_API_KEY`+`EMAIL_FROM`, `APP_URL`,
  `FIREBASE_SERVICE_ACCOUNT`(opt — JSON string; enables FCM push delivery),
  **`SUPABASE_URL`+`SUPABASE_SERVICE_KEY`+`SUPABASE_BUCKET`** (opt — enables CA document sharing; use the
  new `sb_secret_` key; create a **private** bucket `ca-documents`).
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
- **Ask PayWatch** as hero (nav/dashboard/landing) + topical scope guard + chat goal-creation;
  **Portfolio X-ray** (holdings look-through, inside Invest); **risk-based realistic growth projections**;
  **client-side SWR cache**; **statement de-dup**; **invest record-as-started + approx figures**; **vehicle
  asset + motor insurance**; **ACID transactions**; **CA helper repositioning** (no "replace your CA");
  **15 demo personas**; **Supabase Mumbai DB** (India residency).
- **CA portal (§11)** — CA signup/login, two-way connect handshake, client tax-pack view, in-app
  messaging, document sharing (Supabase Storage). Field-level encryption + CA verification still TODO.

### Software still to build (legal now, no registration needed)
1. **Form 16 auto-fill** ✓ (best-effort PDF parse on the wizard). **26AS / AIS JSON import & reconciliation** still to do.
2. **Capital-gains statement importer** ✓ — broker P&L CSV → STCG/LTCG into the wizard (`parseCapitalGainsCsv`).
3. **CA document generators** — rent receipts ✓, 80G receipts ✓, net-worth statement ✓. Still: printable
   computation-sheet PDF (wizard currently downloads a .txt), salary/income certificate.
4. **GST suite** for business users — GSTR-1/3B preparation/summaries.
5. **Firebase push** — server delivery DONE via FCM HTTP v1 (`adapters/push.ts`, uses `jsonwebtoken`, no
   firebase-admin). Activates when `FIREBASE_SERVICE_ACCOUNT` env is set; still needs the native Firebase
   config (google-services.json / APNs) and `NEXT_PUBLIC_PUSH_ENABLED=1` for the apps.
6. **Onboarding DPDP consent notice + under-18 (guardian) consent** ✓ — recorded in `consents`.
7. **Hard paywall enforcement** — gate premium endpoints server-side for non-CFO plans (currently soft banners).
8. **AIS reconciliation, audit/notice helpers** — later.

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
- **Test suite:** `cd server && npm test` runs **136 assertions** across `test/*.ts` (the script loops
  every file): `calc` (tax/filing/score/networth math + edge cases), `engines` (score dimensions, ITR
  form branches, surcharge, investment risk logic, goals), `services` (alerts, statement analyser,
  actions, insurance, tax copilot, investment guardrails), `branches` (recurring/reduce, growth levers,
  edge bands), `guardrails` (SEBI block/allow patterns + AI context), `middleware` (rate-limit + JWT auth
  with mocked req/res), `webparsers` (date/money/Form-16 extraction from `web/src/lib/statementParse`).
  Pure functions only — no DB. Run after any logic change. Untested without infra: DB-backed routes
  (need Postgres) and React components (need a frontend test runner).
- **Security:** all SQL parameterised (the few interpolated bits use whitelisted column names); every
  `/:id` route scopes by `user_id` (or `ca_id`); rate limits on OTP, AI Q&A, statement/transaction/filing
  endpoints; server refuses to boot in production with default JWT secrets.

---

## 11. CA portal
A second account type (Chartered Accountants) alongside users. Built across phases 1–5.

- **Identity:** `cas` table; CA tokens are JWT `role:'ca'` (15m access + stateless 90d refresh — no
  rotation/revoke yet, hardening TODO). `requireCa` guards `/v1/ca/*`; `requireAuth` rejects CA tokens.
  Login/signup via the same OTP pipeline (`verifyOtp`). Self-declared signup (name, ICAI no., firm, city,
  email) — **no verification gate yet** (TODO). CA web client = `lib/caApi.ts` (`paywatch_ca_*` tokens).
- **Pages:** `/login` has a User/CA toggle → `/ca/login` (signup+login), `/ca` (home: connect code +
  client list + add-client), `/ca/client/[id]` (tax-pack view + messaging + docs). User side = **Your CA**
  (`/advisor`) + `/advisor/[id]` (thread).
- **Handshake (`caLink.ts`):** every user & CA has a unique `connect_code` (`PW-…` / `CA-…`). Either side
  enters the other's code → `ca_client_links` row `pending` (`initiated_by`); the **other** party approves
  → `active`. If both have requested, it auto-activates. Reject/disconnect DELETEs the row (re-linkable).
- **Sharing (`caShare.ts`, active links only):** `ca_messages` (in-app chat) and `ca_documents`
  (Supabase Storage, signed URLs, ≤8 MB). CA's read-only client view computes score/net-worth/tax-pack
  live from the client's profile. Documents need `SUPABASE_*` env + a private `ca-documents` bucket.
- **Demo:** no CA seed yet; create one via the signup flow (OTP from logs / `424242` locally).
