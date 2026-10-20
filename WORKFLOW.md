# PayWatch — WORKFLOW (living log of how the app actually works)

> Companion to `CLAUDE.md`. CLAUDE.md = *what* PayWatch is and *why* (context + memory).
> This file = *how it runs end-to-end*: request/response flow, function calls, API calls,
> data flow, and per-feature pipelines. **Keep updating this whenever a flow changes or a
> feature is added.** Last updated: Aug 2026 (initial full pass; SSE realtime, vault,
> encryption, web↔mobile sync reality captured).

---

## 0. How to read this

- **API base:** web/mobile call `NEXT_PUBLIC_API_URL` → `https://api.paywatch.in/v1` (prod),
  `http://localhost:4000/v1` (dev). Everything is under `/v1`.
- **Money:** every amount server-side and in the DB is **paise** (₹1 = 100 paise). The web
  formats with `inr()` / `inrApprox()` / `inrRange()` at the very edge only.
- **Auth on every call:** `Authorization: Bearer <access>` (15-min JWT). On `401`, the client
  silently refreshes once (§2) then retries; a second failure bounces to `/login`.
- **One golden rule of data flow:** *any write that changes a user's financial picture ends by
  recalculating the Money Health Score and (where relevant) saving a RAG memory note.* If you
  add a new write path, wire it into `recalculateAndStoreScore()` (§4) or you'll show stale scores.

---

## 1. Client architecture & the read/write cycle (`web/src/lib/api.ts`)

The single client module every page uses.

- `get(path)` → `api(path)` → `fetch` with `cache:'no-store'` (always hits network).
- `post/patch/put/del` → same, then `bust()` → **`clearCache()`** (any mutation wipes the read cache so the next read is fresh — you never act on stale numbers).
- **SWR read cache** (`swr(path, onData, ttlMs)`): renders instantly from `mem` Map + `sessionStorage`, then refetches in the background and calls `onData` again. Pages use `swr()` instead of `get().then(setX)` so revisits feel instant. `ttlMs>0` skips the network if the cached value is younger than TTL.
- **Cache keys** = the request path; **busted** on every write and on login/logout (`clearTokens()`).
- `subscribeEvents(onEvent)` → opens **SSE** `GET /v1/events?token=<access>` and calls `onEvent()` on each server push (used by CA/user messaging + connection handshake for instant refresh). EventSource can't set headers, so the JWT rides in the query string.
- `downloadFile(path, filename)` → authenticated binary fetch (server decrypts) → browser save. Used for encrypted vault/CA/records file downloads.

**Mobile note:** the native app is the *same* `api.ts` running inside a Capacitor webview, pointed at the same prod API. No separate mobile client.

---

## 2. Auth flow (OTP → JWT → rotating refresh)

```
POST /v1/auth/otp/request   { mobile:'+91…' }         → sends OTP (msg91 prod / logs dev; 424242 in non-prod)
POST /v1/auth/otp/verify    { mobile, otp }            → { access_token(15m), refresh_token(90d), user }
                                                          (verifyOtp is shared by USER and CA login)
POST /v1/auth/token/refresh { refresh_token }          → new access + ROTATED refresh (old one invalidated)
```

- Tokens stored in `localStorage` (`paywatch_access` / `paywatch_refresh`). CA side uses separate `paywatch_ca_*` keys via `lib/caApi.ts`.
- OTP is **never** returned to the client (read from Railway logs in dev).
- `middleware/auth.ts`: `requireAuth` (rejects CA tokens), `requireCa` (guards `/v1/ca/*`, needs `role:'ca'`).
- `middleware/rateLimit.ts`: global 1000/min + tighter limits on OTP, AI Q&A, statement/txn/filing routes.

---

## 3. App boot / first paint (per navigation)

```
Native launch → native.ts (biometric lock overlay, splash, status bar, haptics, push register → POST /user/push-token)
Web/native route load → (app) layout: AuthRedirect (guards token) → sidebar + mobile nav
   → WelcomeSplash ("Hello, {name}") once per app-open (sessionStorage paywatch_greeted)
   → NavTransition thin top progress bar flashes on usePathname change
Each page: swr() the data it needs → deferred LoadingScreen shows ONLY if still loading after delayMs(200ms)
   → content gated on !loading; global "Profile updated" toasts via lib/toast + <Toaster/>
```

---

## 4. THE core loop — Money Health Score (`services/score.ts`, `services/profile.ts`)

Every financial write funnels through here.

```
recalculateAndStoreScore(userId, trigger):
  p = loadProfileData(userId)                     // profile.ts
     ├─ users row (income, take-home, dependents, age, employment_type, risk, city/state)
     ├─ profiles row (assets, liabilities, insurance, tax_data  — all JSONB)
     └─ monthlyExpenses = avg(last 3 months of debit txns, excl investments/transfers)
                          ELSE profiles.assets.monthly_expenses (manual)
  result = computeScore(p)                         // 6 weighted dims, renormalised if a dim is N/A
     savings 25 · insurance 20 · diversification 20 · emergency 15 · debt 10 · tax 10
     (student/young-aware: insurance excluded for students / no dependents;
      tax dim excluded below ~₹12.75L income)
  INSERT INTO score_history (score + each dim + trigger + profile_snapshot JSONB)
```

Triggers that call it: onboarding submit, action "mark done", statement import, records upload, insurance policy add/delete, vault upload, invest "mark started", any profile edit in Settings.

Read side: `GET /v1/score` → latest `score_history` row → dashboard `ScoreGauge` animates 0→score.

---

## 4b. THE money brain (`services/brain/*`, `routes/brain.ts`) — Oct 2026
One pass, used by dashboard (`NextMoves`), Dreams page (`/goals`), alerts and Ask PayWatch:
```
loadProfileData + goals + last-6-months transactions
  → buildMoneyMap(p)            free = take-home − expenses(incl. EMIs) − SIP; liquidReserve(); safety net 6× (3× students)
  → planDreams(map, dreams)     waterfall: safety (≤50% free) → future-you floor → joy 10% → dreams by priority/date
                                + cascade dates + levers (use spare cash / joy / trim category / extend / reduce / lump sum / reprioritise)
  → detectLifeEvents(txns)      salary hike/drop, bonus, new EMI, big purchase
  → buildNextMoves(...)         alerts + events + dream decisions + rule actions → dedup → rank (impact × urgency × protects-a-dream)
GET  /v1/brain            → { map, plan, moves, events, phase }
POST /v1/brain/afford     → affordCheck(): yes_now | yes_by | stretch | not_yet (+ affects, levers)
GET  /v1/brain/readiness  → integration seams: live/mock/off + what flips each live
```
Ask PayWatch (`cfo-ai.ts`): `parseAffordIntent()` → `brainAfford()` verdict injected into the AI context (and prepended in
rules mode); plan summary + every dream's status are in the context. `monitor.gatherSignals` derives goal health from
`planDreams` so goal alerts match the Dreams page. Tests: `server/test/brain.test.ts` (37 checks, incl. engine-agreement).

## 5. Per-feature pipelines (function + API + data flow)

### Overview / Dashboard (`(app)/dashboard`)
`swr('/score')`, `swr('/networth')`, `swr('/actions')`, briefing → renders ScoreGauge hero, interactive 5-yr **opportunity slider** (calls `networth.growthProjection()` numbers; "Recommended for you" snaps to `improvedSurplus`), Ask spotlight (deep-links `/ask?q=`).

### Onboarding (`/onboarding`, public)
3-session form → `PATCH /v1/user/me` (income, dependents, employment_type incl `student`/`both`, risk, state→city, DPDP consent → `consents`) → `recalculateAndStoreScore('onboarding')`.

### Actions (`(app)/actions` → `services/actions.ts`)
`GET /v1/actions` → rule engine ACT-001…ACT-021, each with computed `priority` + `inrRange` sizing. "Mark done" → `POST /v1/actions/:id/complete` { howMuch?, into? } → writes to profile → `recalculateAndStoreScore('action_complete')`.

### Net worth (`(app)/networth` → `services/networth.ts`)
`GET /v1/networth` → allocation donut, assets/liabilities, `growthProjection()` (baseline = current SIP; improved = 25% of take-home, step-up 10%/yr; rates 7/9/11% by risk; nominal; returns `riskAppetite` + `assumedReturnPct`), spending breakdown.

### Invest (`(app)/invest` → `services/investment.ts`)
`GET /v1/invest` → risk profile, target-mix donut, fund-**category** recs (never a named scheme), model portfolios, monthly SIP plan (`takeHome/monthlyExpenses/currentSip/surplus`). "I've started this" → `POST /v1/invest/started` → bumps SIP, hides category (`assets.invest_started`), recalcs. Portfolio X-ray: upload holdings → `POST /v1/holdings/analyze` → `holdings.ts analyzeHoldings()` (asset class + cap + sector → diversification grade). (`portfolio.ts` = sibling look-through engine w/ FUND_CATEGORIES.)

### Tax (`(app)/tax` → `services/tax.ts`, `services/taxFiling.ts`)
`GET /v1/tax/full` → `taxFiling.fullFiling(p)` = complete computed return across every head (salary, interest, house property, dividends, business, STCG/LTCG), both regimes, ITR form pick, TDS reconciliation, refund/payable. Tabbed UI. `tax.ts`: `taxReductionPlan()`, `taxCopilot()` (advance-tax schedule, proof calendar, harvesting, CA-ready pack), `salaryTaxBreakdown()` (payslip window). Engine internals: `computeReturn` (set-off + carry-forward: STCL→STCG&LTCG, LTCL→LTCG only, HP loss ≤₹2L, business loss + depreciation, brought-forward consumption; surcharge cap 15% on CG + marginal relief). ITR-docs prep embedded as a tab (`ItrDocPrep`, knowledge from `itr.ts`). File-it-yourself guide at `/file/self`.

### Insurance (`(app)/insurance` + `/insurance/market`)
- My policies: upload PDF → `POST /v1/insurance/ai-extract` (`docAI.analyzeDocumentGeneric` via Claude: validates doc type, reads cover/premium/dates, `readable` flag) → user confirms → `POST /v1/insurance/policies` (encrypted store) → `syncProfileInsurance()` rolls into `profiles.insurance` → recalcs + expiry/renewal/maturity **alerts** (`monitor.gatherSignals` → `alerts.insuranceExpiries`).
- Marketplace: `GET /v1/insurance/market/categories|plans` → `insuranceCatalog.ts` (real plans, `basePerLakh`) + `insuranceMarket.rankPlans()` (transparent score → "★ Matches your inputs" + reasons + **indicative** premium). Checkout → category-aware (motor IDV tiers + add-ons) → `POST /v1/insurance/applications` (**intent only — no premium collected, no policy issued; needs corporate-agent licence to go live**).

### Monthly Records (`(app)/records` → `services/monthlyRecords.ts`, `services/docAI.ts`)
24 doc types / 8 categories, month picker. Upload → client extracts text → `POST /v1/records/ai-extract` (Claude identifies + validates + reads; falls back to deterministic `parsePayslip`/`parseForm16`; tabular docs → CSV/Excel parsers) → user confirms → `POST /v1/records` + `/records/:id/file` (AES-256 encrypted → Supabase Storage). **Every upload:** whitelisted figures merge into `tax_data`, score recalcs, RAG note saved, per-month progress count updates. **Reverse-on-delete:** each record stores `contribution` JSONB (prev tax_data + txn fingerprints) → delete warns with `affects[]`, restores prev values (if still current) + removes those txns + recalcs. Payslip → `POST /v1/records/tax-preview` (annualised slab-by-slab both regimes). CA reads via `/v1/ca/clients/:id/overview` + `/records/:rid/file`.

### Statement scan (`(app)/statement` → `services/statement.ts`, `lib/statementParse.ts`)
Client-side CSV/Excel/PDF parse → spending dashboard (KPIs, category donut, merchants, "where you could've saved") → `POST /v1/statements/analyze` persists **de-duped** txns (sha256 `fingerprint`, partial-unique on user+fingerprint; re-uploads skip dupes) inside `withTransaction()` → recalcs.

### Document Vault (`(app)/vault` → `services/vault.ts`, `services/encryption.ts`)
Multiple encrypted files per slot → `POST /v1/documents/:id/file` (AES-256-GCM via `encryption.ts`, ≤8MB, → Supabase Storage) + renewal reminders (feed alerts). Download → `downloadFile()` (server decrypts). Delete → confirm → recalcs.

### Alerts (`(app)/alerts` → `services/alerts.ts`, `services/monitor.ts`)
`GET /v1/alerts` → generators (urgent/warning/info/good) over `monitor.gatherSignals`. Mark read/dismiss. Cron (`/v1/cron/run`, `x-cron-key`) regenerates for all users + emails (Resend) + pushes (FCM) digests once (`emailed_at`).

### Ask PayWatch (`(app)/ask` → `services/cfo-ai.ts`, `services/rag.ts`)
`POST /v1/qa` → `cfo-ai`: `checkScope()` topical guard → RAG (`rag.ts`, Postgres FTS over 47-doc KB + user context: active goals + uploaded insurance policies with exact dates) → Claude (`claude-sonnet-4`) or rules fallback. Can create goals from chat (`parseGoalIntent()`).

### Your CA / CA portal (`(app)/advisor` + `/ca/*` → `services/caLink.ts`, `services/caShare.ts`)
Handshake: each side has a `connect_code` (`PW-…`/`CA-…`) → enter other's code → `ca_client_links` pending → other approves → active (auto-activates if both requested). Active: `ca_messages` (encrypted) + `ca_documents` (encrypted, Supabase, signed URLs). SSE (`/v1/events`) pushes instant refresh on message/handshake. CA read-only client view computes score/net-worth/full ITR (`fullFiling`) live + downloadable summary. **Private tool, never a marketplace (ICAI).**

### Billing (`(app)/plans` → `routes/billing.ts`, `adapters/billing.ts`)
`GET /v1/billing/plans` → `config.PLANS` (Free anchor + Starter ₹199 [regular ₹349] + CFO ₹499 [regular ₹799]; `regular_price` powers struck price). `POST /v1/billing/subscribe` { plan, cycle } → sandbox/Razorpay → welcome modal. GST invoices listed.

---

## 6. Adapters (swap dev ↔ prod by env)
`sms.ts` (logs / msg91) · `aa.ts` (mock / Finvu — **keep mock until FIU**) · `billing.ts` (sandbox / Razorpay) · `email.ts` (logs / Resend) · `push.ts` (log / FCM HTTP v1 when `FIREBASE_SERVICE_ACCOUNT` set) · `storage.ts` (Supabase Storage; on when `SUPABASE_URL`+`SUPABASE_SERVICE_KEY`).

---

## 7. Deploy / runtime flow
- Push to GitHub `main` → Railway (API, `server/`) auto-builds: **Pre-Deploy `npm run migrate:prod`** (idempotent schema) → `node dist/index.js`. Vercel (web, `web/`) rebuilds; `NEXT_PUBLIC_API_URL` baked at build.
- DB: Supabase Postgres Mumbai via **Session pooler** URI. SSL auto for non-localhost.
- Cron: Railway cron → `POST /v1/cron/run` (`x-cron-key`).

---

## 8. Web ↔ Mobile sync — HOW it stays in sync (important)
There is **ONE codebase**. The mobile app is `web/` statically exported (`BUILD_TARGET=mobile next build` → `web/out/`) and wrapped by Capacitor into `web/android` / `web/ios`. So the app can never "drift" at the source level — but the **native build artifact goes stale** until you re-run the sync.

**To bring mobile up to the web version (run on the Mac):**
```
cd web
npm run cap:sync         # = build:mobile + cap sync  (rebuilds out/ and copies into native)
npx cap open ios         # then rebuild/run in Xcode   (Mac + CocoaPods)
npx cap open android     # then rebuild/run in Android Studio
```
Push stays OFF until `NEXT_PUBLIC_PUSH_ENABLED=1` + Firebase config (google-services.json / APNs).

> **Current status (Aug 2026): mobile is STALE.** Native bundles date to ~Jun 29; web source has ~2 months of changes since (premium landing, loading system, dashboard restructure, tax tabs, insurance rework, pricing restructure) that are **not** in the native apps. Fix = run `npm run cap:sync` + native rebuild on the Mac. No code porting needed.

---

## 9. Future flows (fill in as built)
- **AIS/26AS JSON import & reconciliation** → new parser → merge into `tax_data` → same recalc loop.
- **ERI e-filing** → after registration, `/file/self` guide → in-app one-click submit.
- **AMFI MFD investing** → Invest "start" → BSE StAR MF order (via Cybrilla/FintechPrimitives) instead of "mark started".
- **Insurance go-live** → swap indicative premium → live quote; application submit → KYC + pay + issue (needs corporate-agent licence / broker partner). *No UI/engine rebuild — only data source + issue/pay step.*
- **Live bank data (AA/FIU)** → replace statement upload with consented AA pull → same de-dup import.
- **Hard paywall** → gate premium endpoints server-side for non-CFO plans.
