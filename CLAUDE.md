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
- **Audiences:** working professionals AND **students (~19–23)**. `employment_type` includes `'student'`
  and **`'both'`** (salaried + owns a business — gets both salaried tax steps AND business/advance-tax guidance).
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
- **Tax** (`tax`) — **Full computation** section (`GET /tax/full` → `fullFiling`): comprehensive CA-usable
  breakdown across **every income head** (salary, interest, house property, dividends, business, STCG/LTCG),
  deductions, both regimes, ITR form + why, TDS reconciliation, refund/payable, downloadable for the CA.
  Then regime comparison, "how to reduce your tax", **Tax Copilot** (advance-tax timeline, proof calendar,
  harvesting, CA-ready pack), deduction tracker, calendar, docs + glossary. Section nav.
- **Prepare ITR docs** (`file`) — two paths: hand to CA, or **File it yourself** (`/file/self`): a detailed
  beginner step-by-step guide (gather docs → AIS/26AS → which ITR form (1/2/3/4 explained) → portal login →
  filing → verify against computation → pay/refund → submit & e-verify), personalised with the user's
  computed form/regime/refund. Plus the `ItrDocPrep` doc-gathering checklist.
- **Insurance** (`insurance`) — **My policies** (upload policy PDFs by category → AI reads cover/premium/issue/
  expiry/maturity/renewal dates, validates the doc + flags wrong/blurry, user confirms; encrypted store; feeds
  cover rings + score; expiry/renewal/maturity **alerts** with follow-up), **Find & compare plans** marketplace
  (`/insurance/market`), coverage **rings**, collapsible "what to get" recommendations, avoid list.
  `InsurancePolicies.tsx` component.
- **Insurance marketplace** (`insurance/market`) — CRED-style browse → compare → **in-app buy** across **all
  categories** (term/health/PA/CI/motor/home/travel). Real insurers/plans/features/claim-ratios +
  `CATEGORY_COVERAGES` + `CATEGORY_ADDONS` (motor: zero-dep/NCB-protect/engine/roadside/etc. with indicative
  prices; health/term riders) in `insuranceCatalog.ts`; `insuranceMarket.ts` ranks for the user (transparent
  score + "best fit" reasons + **indicative** premium, not a live quote). **PlanCard** = insurer monogram +
  Recommended/Best-priced badges + coverages + View-benefits expand + Select. **Checkout** (`Checkout` in the
  page) = category-aware: motor **IDV tiers** (min/std/max) + **add-on upgrades** with running total →
  **"calculating your final premium"** loader → **review** (net + 18% GST + your details + consent) → submits
  an **application** (`insurance_applications`; intent-only, no premium collected — see §8). Routes
  `/insurance/market/categories`, `/insurance/market/plans` (returns plans+coverages+addOns),
  `/insurance/applications` (list/create/withdraw). **GOING LIVE NEEDS THE CORPORATE-AGENT LICENCE — see §8.**
- **Monthly records** (`records`) — recurring monthly-upload hub (CA-requested): month picker + **24 doc
  types grouped into 8 categories** (Income & salary, Tax statements, Banking & spending, Investments, Loans,
  Deductions & tax-saving proofs, Insurance & property, Business & self-employed) — payslip, Form 16/16A,
  26AS/AIS, bank + credit-card statements, demat/MF CAS, capital gains, dividend & interest certificates,
  home/other loan certs, rent receipts, 80C/80D/NPS/80G proofs, insurance, property deeds, GST returns, P&L.
  Per-record **Remove (with confirm) + Replace**. **Strict formats**
  enforced (PDF text / Excel / CSV; images rejected for parseable docs so a blurry scan can't corrupt data).
  **AI reader** (`docAI.ts`, route `POST /records/ai-extract`): for PDF/free-form docs (contract, letter,
  payslip, Form 16, 26AS) the client extracts text → Claude identifies the doc, **validates it matches the
  expected type (flags a wrong/random upload)** and reports a `readable` flag, and extracts fields regardless
  of layout. The client also flags **blurry/scanned/low-quality PDFs with no usable text layer** before the
  AI call (near-empty extracted text → "upload a clearer file"); Claude's `readable:false` catches garbled-OCR cases. Falls back to the
  deterministic `parsePayslip`/`parseForm16` (tuned to real Indian payslips with bare-integer line items and
  Form 16 Part A/B totals) when `ANTHROPIC_API_KEY` is unset or the call fails. Tabular docs (statement/holdings/
  capital gains) stay on the structured CSV/Excel parsers. User **confirms** values before save (never trusted blindly). Payslip → annualised **tax-liability window** (slab-by-slab, both regimes, marginal +
  monthly TDS) via `/records/tax-preview`; bank statement → imports de-duped transactions; holdings → look-through
  grade. Files AES-256 encrypted; visible read-only to the connected CA. **Every upload updates the user:**
  whitelisted figures merge into `tax_data` (home-loan interest/principal, 80D, NPS, 80G, rent → feed the
  deduction tracker + tax score + Actions), the score is recalculated, and a RAG memory note is saved so
  Ask PayWatch stays current. A per-month **progress count** ("X of Y uploaded · Z to go") nudges more uploads.
  **Reverse-on-delete:** each record stores a `contribution` JSONB (prev tax_data values it overwrote + the
  bank-statement txn fingerprints it imported). Deleting warns the user with the exact **affected areas**
  (`affects[]` from listRecords), then restores prev tax_data (only if still the value it set — later records
  win) + removes those transactions + recalcs. (Insurance delete already auto-reverses via `syncProfileInsurance`.)
- **Statement scan** (`statement`) — client-side CSV/Excel/PDF parse → **spending dashboard**: period range,
  KPIs (in/out/net/savings rate + monthly avg), SVG **donut** of categories, flexible-vs-essential-vs-invested
  split, top merchants, largest expenses, a headline **"where you could've saved"** total + suggestions,
  recurring payments, watch-outs/positives. `statement.ts` analyser; persists de-duped txns + recalcs score.
- **Document vault** (`vault`) — store **multiple encrypted files per slot** (e.g. several rent receipts),
  each with download + **Remove (confirm)** + renewal reminders (feeds alerts). Upload recalcs score.
- **Uploads everywhere** (records, insurance, vault, ITR-prep) → server **recalculates score** + a global
  **"Profile updated" toast** (`lib/toast` + `Toaster` in app layout); every remove asks for confirmation.
  CA-thread documents are removable too (`DELETE …/documents/:docId` both sides).
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
- `taxFiling.ts` — **ITR engine**: `assembleFilingInputs(p)` builds complete inputs from profile + tax_data
  (all heads + TDS that uploads folded in); `fullFiling(p)` = the full computed return (used by `/tax/full`,
  the wizard prefill, and the CA overview). `prepareFiling()` picks ITR-1/2/3/4, computes full return across all
  heads (salary, interest, house property, equity STCG 20% / LTCG 12.5% over ₹1.25L, non-equity STCG@slab /
  LTCG 12.5%, business), both regimes incl. rebate/surcharge/cess. **Full set-off & carry-forward engine**
  (`computeReturn`): STCL→STCG&LTCG / LTCL→LTCG only; house-property loss ≤₹2L vs other heads; business loss
  vs non-salary heads (+ **depreciation**); brought-forward losses consumed; unused losses carried forward
  (surfaced in `carryForward` + `setOffNotes`). **Surcharge capped 15% on CG + marginal relief** near thresholds.
  Reconciles TDS + advance tax → refund/payable, flags rare audit-needs-CA case, outputs checklist + portal
  walkthrough. Heavily unit-tested (`engines.test.ts` set-off/loss/depreciation/marginal-relief cases).
- `insurancePolicies.ts` — uploaded insurance policy store (encrypted file + AI-read fields; CRUD; `syncProfileInsurance`
  rolls active policies into `profiles.insurance.term/health` so cover analysis + score update). `docAI.ts` exposes
  **`analyzeDocumentGeneric()`** (label + field guide + type options) used by every upload surface; `analyzeDocument`
  is the ITR wrapper. Insurance routes live in `insights.ts` (`/insurance/policies*`, `/insurance/ai-extract`).
  Expiry/renewal/maturity alerts: `monitor.gatherSignals` → `alerts.ts` `insuranceExpiries` (urgent ≤7d, warning ≤30d, maturity ≤60d).
- `insuranceCatalog.ts` — curated DB of **real** plans across all categories (insurer, plan, claim ratio,
  public features, `basePerLakh` for the indicative premium, insurer `buyUrl`). Educational; `verifyNote`
  surfaced in UI. `insuranceMarket.ts` — `estimatePremium()` (indicative, per category) + `rankPlans()`
  (transparent score: claim ratio + price vs cheapest + preferred-tag match → "best fit" + reasons). Routes in
  `insights.ts`: `/insurance/market/categories`, `/insurance/market/plans`.
- `insurance.ts` — 25× term rule (no life cover without dependents), health sizing, personalised
  "what to get" + "what to avoid". Student-aware.
- `investment.ts` — SEBI-compliant guidance: risk profile, target allocation, fund-**category**
  recommendations, model portfolios, monthly SIP plan. Returns `takeHome/monthlyExpenses/currentSip/surplus`
  for the clean plan card; hides categories in `assets.invest_started`. Never names a product.
- `monthlyRecords.ts` — **Monthly Records** store: encrypted file per record (Supabase Storage, `records/<user>/…`)
  + user-confirmed `extracted` JSON; `listRecords/createRecord/attachRecordFile/getRecordFile`. `tax.ts` adds
  `salaryTaxBreakdown()`/`salaryTaxComparison()` (slab bands + rebate/surcharge/cess + marginal/effective +
  monthly TDS) powering the payslip tax window.
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
  creation, model `claude-sonnet-4`; **context includes the user's active goals AND uploaded insurance
  policies with exact expiry/renewal/maturity dates** so "when does my insurance expire?" answers from real
  data — both in the Claude prompt and the rules fallback), `rag.ts` (Postgres FTS, **47-doc** seeded KB,
  incremental seed), `profile.ts` (load ProfileData + recalc).
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
`/spend`), `goals`, `qa`, `billing`, `compliance`, `aa`, `reports`, `alerts`, `documents`,
**`records`** (`/records` list, `/records/types`, `/records/tax-preview`, `/records/ai-extract` (Claude doc
reader+validator, `docAI.ts`; soft-fails to `available:false`), POST `/records` + `/records/:id/file`,
GET `/records/:id/file`, DELETE) — monthly financial records; CA reads them via `/ca/clients/:id/overview`
(`monthlyRecords`) + `/ca/clients/:id/records/:rid/file`. `cron`,
**`ca`** (`/auth/(register|login|token/refresh)`, `/me`, `/clients` connect/approve/reject/delete,
`/clients/:id/(overview|messages|documents)`). CA tokens are JWT `role:'ca'`; `requireCa` guards CA
routes, `requireAuth` rejects CA tokens. JSON body limit raised to 12mb for base64 doc uploads.

### DB tables
`users`(+state,risk_appetite,email,**connect_code**), `otp_codes`, `refresh_tokens`, `profiles`,
`score_history`, `actions`(+priority), `goals`, `transactions`(+**fingerprint**, partial-unique on
user+fingerprint), `conversations`, `messages`, `rag_documents`, `subscriptions`, `invoices`, `consents`,
`notifications`, `documents`, **`monthly_records`**(period YYYY-MM, doc_type, encrypted file +
`extracted` JSONB), **`insurance_policies`**(category, insurer, sum_assured, premium, issue/expiry/maturity/
renewal dates, encrypted file + `extracted`), `device_tokens`, `audit_log`, and the **CA portal**: `cas`,
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
- **Loading / motion system** (engagement): `components/Skeleton.tsx` = `Skeleton/SkeletonCard/SkeletonList/
  PageSkeleton` + `WittyLoader` + **`LoadingScreen`** (big centred animated gauge + rotating sarcastic caption
  that crossfades away when `loading` flips false — used inside a `relative min-h-[60vh]` wrapper with content
  gated on `!loading`; wired into actions/insurance/tax/invest/networth/markets/reports pages). `components/
  WelcomeSplash.tsx` = "Hello, {name}" splash once per app-open (sessionStorage `paywatch_greeted`).
  **`components/NavTransition.tsx`** = GLOBAL route-transition curtain in the app layout: on every `usePathname`
  change it covers the content area (`fixed md:left-60 top-14 md:top-0 bg-paper`) with the gauge + a
  context-aware caption from **`lib/quips.ts`** (`quipsForPath()` route→quips map) + a thin top progress bar,
  then eases away. Skips first mount (welcome splash owns it); does NOT fire on query-only navs (avoids
  `useSearchParams` to keep the static export safe). Animations in `globals.css` (`pw-splash/pw-splash-leave`,
  `pw-ring-draw`, `pw-sweep`, `pw-fade-up`, `pw-page-in`, `pw-navbar`, `pw-skeleton`) all respect
  `prefers-reduced-motion` (global disable) with JS safety-timeouts so curtains never get stuck. CA portal
  (`/ca/*`, separate layout) not yet wired.

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
- **Insurance — CHOSEN PATH: Corporate Agent, end-to-end in-app (CRED model).** Decided with the owner.
  PayWatch will become an **IRDAI Corporate Agent** (₹50L capital/net worth; can tie up with **up to 9 insurers
  per line** — life/general/health) and deliver the whole journey *inside the app* (compare → buy → manage →
  renew → claims assist), with policies underwritten by partner insurers — like CRED. (Alternatives weighed:
  Direct Broker = ₹75L capital + ₹50L net worth, any insurer, higher burden; Insurance Web Aggregator. Bima
  Sugam — IRDAI's unified marketplace rail, phasing in from ~Dec 2025, zero-commission — is the long-term rail
  to design toward.)
  - **Licence + partner checkpoints (track at every step):** (a) incorporate + ₹50L net worth; (b) IRDAI
    corporate-agent registration + board-approved open-architecture policy; (c) Principal Officer + specified
    persons / PoSP, KYC, anti-mis-selling, grievance officer; (d) signed tie-ups + **quote/issue APIs** with the
    partner insurers (no public free cross-insurer API exists). Interim, a faster route is **partnering with an
    existing licensed broker/embedded-insurance provider** who supplies quotes/issuance/servicing under their
    licence — gets end-to-end live sooner without our own licence.
  - **What's built now (no licence yet):** real-plan catalogue + best-fit ranking + **indicative** premiums +
    an **in-app application flow** that captures the user's intent (`insurance_applications`) and shows it as
    *"submitted — issuance activating soon."* **We do NOT collect premium or issue a policy yet** (that needs the
    licence + insurer API). When live: swap indicative premiums → live quotes, and the application submit →
    real KYC + payment + issuance. **No UI/engine rebuild — only the data source + the issue/pay step change.**
  - Until licensed: premiums stay "indicative", no premium is collected, applications are intent only, and the
    UI says policies are arranged "through our IRDAI-licensed insurer partners (activating soon)."

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
9. **IRDAI Corporate-Agent registration (CHOSEN)** — ₹50L net worth + board-approved open-architecture policy +
   Principal Officer/PoSP + tie-ups & quote/issue APIs with partner insurers (≤9/line). Turns the in-app
   application flow into real KYC+payment+issuance and the indicative premiums into live quotes. Interim
   accelerator: partner with an existing licensed broker/embedded-insurance provider. See §8. UI/engine already
   built for it (only data source + issue/pay step change).
10. **Legal review** — Terms / Privacy / Disclosures + the SEBI, tax & IRDAI boundaries.

> NONE of §8–9 is legal advice. Engage a CA (entity, GST, audit, ERI) and a lawyer (DPDP, SEBI/tax
> boundary, terms). Verify every rule against the current official source before acting.

---

## 10. Working agreements
- Owner prefers concise, direct answers; owner is new to dev/ops — explain "where to run" things.
- For deployed changes, always call out DB-migration and env-var implications before they go live.
- Keep every money feature inside the education/organisation lane; tax features stay "prepare + guide
  self-file"; add disclaimers on new surfaces.
- Verify with `cd server && npx tsc --noEmit` and `cd web && npx tsc --noEmit` after changes.
- **Test suite:** `cd server && npm test` runs **149 assertions** across `test/*.ts` (the script loops
  every file): `calc` (tax/filing/score/networth math + edge cases), `engines` (score dimensions, ITR
  form branches, surcharge + **marginal relief**, **capital-loss set-off / carry-forward / house-property
  & business loss / depreciation**, investment risk logic, goals), `services` (alerts, statement analyser,
  actions, insurance, tax copilot, investment guardrails), `branches` (recurring/reduce, growth levers,
  edge bands), `guardrails` (SEBI block/allow patterns + AI context), `middleware` (rate-limit + JWT auth
  with mocked req/res), `webparsers` (date/money/Form-16 + payslip extraction from `web/src/lib/statementParse`,
  incl. real Indian salary-slip integers and Form 16 Part A/B totals).
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
  (Supabase Storage, signed URLs, ≤8 MB). CA's read-only client view computes score/net-worth/tax-pack +
  **full ITR computation** (`fullFiling`, all income heads) live from the client's profile, shows the client's
  monthly records, and offers a **downloadable client-summary report**. Documents need `SUPABASE_*` env + a
  private `ca-documents` bucket.
- **Demo:** no CA seed yet; create one via the signup flow (OTP from logs / `424242` locally).
