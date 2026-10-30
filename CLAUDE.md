# PayWatch — Project Context & Long-Term Memory

> Single source of truth for the PayWatch project. Read this first before working on the codebase.
> Keep it updated when architecture, features, deployment, branding, or compliance decisions change.

Last updated: **Oct 2026** (vision shift to the **Money Brain / dreams-first** product; brain engine built;
email-OTP login + demo login; Supabase RLS lockdown; mentor sessions with Upendra Namburi & Ellen van Andel; canvases;
promo video). **Companion docs: `STRATEGY.md` (vision, canvases, journeys, lifecycle economics, action plan — READ
FIRST for "what are we doing and why"), `WORKFLOW.md` (runtime flow per feature) and `DECISIONS.md` (why we chose what
we chose, D-01…D-42). Keep all four updated.**

**Vision (Oct 2026 — supersedes "CFO in your pocket" as the lead message):** PayWatch is **one money brain that turns
every dream into a plan** — it quietly handles tax, insurance and investing in the background so the user can focus on
the life they want (a trip, a café, parents' health, a gol gappa). Primary persona **"Daisy": 22–30 first earners,
small-town & metro, phone-first, no advisor.** Closest competitors: **FOLO** (net-worth tracker, family sharing) and
**Jumpp** (Finvasia×YES Bank AI super-app: bank/trade/pay, Hindi voice); substitute = CA/advisor. Line: *"FOLO shows what
you have, Jumpp helps you transact — PayWatch tells you what to do next to get the life you want."* Canvases live in the
root: `PayWatch-Value-Proposition-Canvas.png`, `PayWatch-Blue-Ocean-Canvas.png`, `PayWatch-Business-Model-Canvas.png`,
`PayWatch-Homework-Value-Proposition-Competition.docx`, `PayWatch-Vision-OnePager.docx`, promo `PayWatch-Promo-v3.mp4`
(source in `video-assets/source`).

**Business status (Aug 2026):** PayWatch is **incubated at the MAHE Innovation Centre** (mentor: Dr. Mathew
Peter / Dr. Mohammed Zuber) and has been **accepted into the XElevate Super Accelerator Program — Cohort 3**
(60% scholarship, net fee ₹50,000; program focus = validation → adoption → scale → investor-readiness).
Founder: Yash Saini (solo build). **First hire: a Market & User Research intern (Vighnesh, task-based,
₹8–10k/mo merit stipend, started 22 Aug 2026)** — inducted via the IC (IC registers the intern + issues the
internship letter on the founder's recommendation, since PayWatch isn't incorporated yet). **Company:** leaning
**Private Limited**, registered in the founder's hometown with local CA/CS help (needs a 2nd director — a
trusted family member/co-founder with a small stake); **trademark** "PayWatch" to be filed (classes 9/36/42)
before heavy public promotion; public LinkedIn launch announcement deliberately held until trademark filed +
traction. Not yet incorporated, no live users/revenue — prototype stage (TRL 7), now moving to validation +
commercialisation. Tagline: **"Watch your money grow."**
**Oct 2026 update:** mentors — **Upendra Namburi** (XElevate expert; "be bold, think 50 years ahead, build deep
personas from real interviews, delight > features, become headless/everywhere") and **Ellen van Andel** (TU Delft VPC /
BMC / Blue Ocean sessions). Research assets: Vighnesh's Task 1 (empathy maps, 20 conversations + 49 surveys), Task 3
(56 interviews: WTP — ₹999/yr most-picked; only ~10% pay without a trial; trust is the barrier), Task 4 (verification
form + TAM/SAM/SOM + tester cohort), **Task 5 "Finding Daisy"** (re-mine Tasks 1/3/4 + 8 deep follow-ups → persona pages
+ combined Daisy, due 31 Oct). Market anchor: 7+ crore ITRs filed AY 2025-26. **Operating rule from now: build the
product to launch-ready behind integration seams; research is time-boxed and feeds the product weekly (see STRATEGY.md).**
Non-code deliverables live in the project root: `PayWatch-Detailed-Deck.pptx/pdf` (self-explanatory investor/
mentor deck), `PayWatch-Pitch-Deck.pptx`, `PayWatch-Poster.*`, `PayWatch-Hiring-Poster.*` (intern recruiting),
`PayWatch-Insurance-Partnership-Brief.md`. **Defensibility framing (from research):** PFM apps die from
*tracking, not acting* — PayWatch's guidance/action layer + moving score is the antidote; monetisation is
distribution-native (insurance + MF commission), which is where every neobank/PFM player eventually pivoted.

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

**Pricing (restructured Jul 2026 — Family plan REMOVED, it was never built):** three columns with
psychology — **Free ₹0** (anchor: Money Health Score + a taste), **Starter ₹199/mo** (was ₹349 struck),
**CFO ₹499/mo** (was ₹799 struck, "Most popular"). Charm prices + struck "regular" (`regular` field in
`config.PLANS`, surfaced as `regular_price` from `/billing/plans`) create the launch-discount illusion.
Plan keys stay `starter`/`cfo` (DB CHECK still lists `family` for back-compat; migrate any existing rows
with `UPDATE users SET plan='cfo' WHERE plan='family';` since `PLANS['family']` no longer exists).

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
├── web/      Next.js 14 (App Router) PWA · Tailwind · port 3000
└── mobile/   Native iOS + Android app — Expo SDK 58 / React Native / expo-router (see §6)
```

- **Money stored in paise everywhere** (₹1 = 100 paise). Web `inr()` formats paise → ₹.
- **Auth (Oct 2026):** **email OTP is the primary real-user login** (`/auth/email/send|verify`, via Resend) because
  Indian SMS OTP needs TRAI DLT registration (needs an incorporated company). Only OTP-proven emails
  (`users.email_verified`) can log in; a verified login email is locked in Settings; `users.mobile` is now nullable.
  **One-tap demo** `POST /auth/demo` logs into persona Aarav (+919000000001, re-seeded each login, CFO plan; disable
  with `DEMO_LOGIN=off`). Mobile OTP (+91) still exists for existing/legacy accounts. JWT 15-min access + 90-day rotating refresh.
  **Security:** schema.sql ends with an idempotent block enabling RLS on every owned public table and revoking
  Supabase `anon`/`authenticated` access (the app connects as table owner, so it bypasses RLS) — keep it LAST. Tokens in `localStorage`
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
- **Dreams** (`goals` route, nav label "Dreams") — dreams-first planner on top of the brain: quick-pick dreams (trip,
  gadget, parents' health cover, course, emergency fund, vehicle, home, wedding, own business), priority (must-have /
  important / nice), per-dream need vs plan allocation, "done by" date (cascade), status chips, **"Make it a yes"**
  levers, virtual safety-net card, plan strip (free to plan, guilt-free money, spare cash, safety net), and the
  **"Can I afford it?"** checker (`POST /brain/afford`). Dashboard opens with **`NextMoves`** (ranked moves from `/brain`).
- **Ask PayWatch overlay (D-46)** — `components/assistant/{Assistant,ChatPanel,VoiceMode,Markdown}.tsx`; opens from any
  page (Talk/Type chooser → voice orb or chat side panel); `/ask` page = same ChatPanel full-page. Web language layer:
  `lib/i18n.tsx` (`LanguageProvider`, `t()`, `LanguageChooser`, `AutoTranslate`), `lib/voice.ts`, `components/Providers.tsx`;
  Settings → App language. **Overview (D-47)** = dream-first story with a three.js money brain
  (`components/overview/BrainScene.tsx`, `parts.tsx`: DreamCard/Tilt/MoneyFlow/AwayFeed/Reveal); CSS in `globals.css`
  (`pw-orb*`, `pw-voice-bg`, `pw-tilt`, `pw-rise`, `pw-stagger`, `pw-flow-path`).
- **Ask PayWatch** (`ask`, RAG
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
- `realtime.ts` — **SSE** live-update hub: in-memory registry keyed by user/CA id; `index.ts` serves
  `GET /v1/events?token=` (JWT in query — EventSource can't set headers) and pushes a tiny refresh *signal*
  (not data) on CA/user messages + connection handshake; client subscribes via `api.subscribeEvents()`.
- `vault.ts` — Document Vault encrypted file store (AES-256, Supabase Storage, ≤8 MB, scoped by user_id).
  `encryption.ts` — app-layer **AES-256-GCM** at rest (key = `ENCRYPTION_KEY` env) for CA docs/messages, vault,
  records, insurance policies; version-prefixed rows; NOT end-to-end (server decrypts to show the CA). `itr.ts`
  — canonical ITR document list + filing steps (shared by user prep guide, CA card, checklist). `holdings.ts`
  **and** `portfolio.ts` — two look-through engines (asset-class/cap/sector diversification grading).
- **Hyper-personalization stack** (see `PERSONALIZATION.md`): `lifestage.ts` — derives a user's life phase
  (accumulation → consolidation → pre_retirement → retirement) from age/employment; every engine reframes
  guidance for it (invest equity target de-risks near retirement, insurance emphasises health, Ask PayWatch
  frames answers by stage). `context.ts` — the **Context & Benefits store**: `profiles.context` JSONB holds
  occupation/employer/sector + structured **benefit facts** (employer group cover, a MAHE-style insurance
  booster, EPF/NPS, govt schemes); `effectiveCoverFromBenefits()` lets the insurance engine credit cover the
  user already has instead of nagging. `benefitsCatalog.ts` — the shared **benefits/schemes catalog** (curated
  govt schemes + employer/occupation patterns, eligibility-matched) + **crowd-learned patterns**
  (`benefit_patterns` table, aggregate only, surfaced past a ≥3-user threshold — DPDP-safe) → proactive
  "people like you often have…" suggestions (`GET /v1/context/suggestions`). Manual UI in Settings → Profile →
  Work & benefits. Routes: `GET/PUT /v1/context`, `POST/DELETE /v1/context/benefits`, `GET /v1/context/suggestions`.

- **`brain/` — THE money brain (single source of truth, Oct 2026):** `cashflow.ts` `buildMoneyMap()` (free = take-home −
  expenses incl. EMIs − SIP; shared `liquidReserve()` = savings + liquid funds + FDs; safety net 6×, students 3×);
  `dreams.ts` `planDreams()` (waterfall safety ≤50% free → future-you 10% if no SIP → joy 10% → dreams by priority/date;
  cascade completion dates; levers use_cash/joy/trim/extend/reduce/lump_sum/reprioritise/free_up), `affordCheck()`,
  `goalToDream()` (dreams = goals with `meta.kind`/`meta.priority`; handles pg Date objects); `lifeEvents.ts`
  `detectLifeEvents()` (salary hike/drop, bonus, new EMI, big purchase); `nextMoves.ts` `buildNextMoves()` (alerts +
  events + dream decisions + rule actions, dedup, ranked); `readiness.ts` integration seams; `index.ts` `runBrain()` /
  `brainAfford()`. Route `routes/brain.ts`: `GET /v1/brain`, `POST /v1/brain/afford`, `GET /v1/brain/readiness`.
  `cfo-ai.ts` `parseAffordIntent()` → deterministic verdict injected into Ask PayWatch; `monitor.gatherSignals` takes goal
  health from the plan so alerts never contradict the Dreams page.
  **Autopilot (D-43):** `autopilot.ts` `brainTick`/`scheduleBrainTick`/`captureDream`/`recentActivity` (tables
  `brain_snapshots`, `brain_activity`); `dreamCapture.ts` (EN/HI/Hinglish intent + cost catalogue + `parseRupees/parseMonths`);
  `i18n.ts` (every brain sentence in EN+HI). Plan items carry `earmarked` + `saved`. **Dream names are bilingual:** captured dreams store `meta.names {en,hi}`;
  `index.localizeDreams()` shows each dream in the current language (stored names → `catalogLocalName()` → AI translate,
  `translateTexts` now works both ways hi↔en). Routes add `GET /brain/activity`,
  `POST /brain/capture`, `POST /brain/tick`.
- **Voice (D-44):** `routes/voice.ts` — `GET /voice/status`, `POST /voice/tts` (ElevenLabs `eleven_multilingual_v2`, LRU
  cache), `POST /voice/stt` (Scribe). Env `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_VOICE_ID_HI`
  (opt `ELEVENLABS_TTS_MODEL`/`ELEVENLABS_STT_MODEL`). Default ElevenLabs voice = premade "Sarah" (`EXAVITQu4vr4xnSDxMaL`), expressive settings (stability 0.35, style 0.45).
  Voice-mode replies use a separate `VOICE_STYLE` prompt (2–4 warm spoken sentences, max_tokens 300). No key → best
  device voice (`pickBrowserVoice` ranks Natural/Neural/Google voices, skips robotic ones like Rishi). Ask accepts `{lang, mode:'chat'|'voice'}`.
  **Mic gotcha:** `web/next.config.mjs` Permissions-Policy must keep `microphone=(self)` (it was `microphone=()`, which
  silently blocked the mic site-wide). `lib/voice.listen()` asks for the mic first and returns a typed `error`
  (denied / no-mic / unsupported / network (Brave/Arc) / dictation-off (Safari) / no-speech / stt-failed) that
  VoiceMode shows in EN/HI; live partial transcript while speaking. Native: Android `RECORD_AUDIO`, iOS
  `NSMicrophoneUsageDescription` + `NSSpeechRecognitionUsageDescription`.
- **Money format (D-49):** every ₹ figure uses Indian grouping (₹1,20,000 · ₹18,60,000 · ₹1,25,00,000). Server: `lib/money.ts`
  `inrIN()` / `inrRangeIN()` used by all services; web: `lib/format` `inr()` full by default (`{compact:true}` only on
  request), `groupDigits()` formats money inputs as you type (state keeps plain digits).
- **Price guide (D-50):** `brain/priceGuide.ts` — `POST /v1/brain/price-guide {text}` → typical prices for a dream as it is
  typed (property ₹/sq ft by city & locality incl. South Mumbai, trips per person × people, cars, bikes, phones, laptops,
  weddings, courses, businesses, health cover); built-in table + Claude refinement (Haiku, 24 h cache); planning ranges,
  never a quote. Web `components/PriceGuide.tsx` on the Dreams form + "Can I afford it?" (tap an option to fill cost).
- **Assistant actions (D-51):** `services/assistantActions.ts` `planActions()` runs before every Ask answer (chat + voice):
  navigate to any page (EN/HI/Hinglish), insurance marketplace deep-link `?category=` (picks the user's biggest gap),
  personal corner **guide** (do / avoid, compliance footnote) for marketplace/tax/invest, update a dream's amount/date,
  set risk or language. `/qa` returns `actions[]`; web `Assistant.runActions()` + `GuidePanel.tsx`. Voice and chat share
  ONE conversation (`sessionStorage paywatch_conv`; switch keeps history); `cfo-ai.recallMemory()` adds snippets from the
  user's other conversations (60 days) to the prompt. Voice: mic kept open across turns, "Getting ready…" → chime →
  listening (no lost first words), VAD threshold 0.025. **Hindi voice:** Sarvam AI Bulbul (`SARVAM_API_KEY`, speaker
  `ritu`, model `bulbul:v3`) → else auto-picked native-Hindi ElevenLabs library voice ("PayWatch Hindi") → device voice.
- **Language (D-45):** `users.language` ('en'|'hi'); `services/translate.ts` + `routes/i18n.ts` (`POST /i18n/translate`,
  `GET /i18n/status` = key set? + last error; `translations` cache table; env `TRANSLATE_MODEL` default Haiku 4.5, falls
  back to `ANTHROPIC_MODEL`; **needs `ANTHROPIC_API_KEY`**). Translates in parallel chunks of 20 with keyed JSON so a
  truncated reply still saves what it can. Web `AutoTranslate` walks the whole `document.body` (overlays included),
  caches only real Hindi on the device (`paywatch_tr_hi_v2`), retries with backoff, shows a "हिंदी में बदल रहे हैं…" pill.

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
renewal dates, encrypted file + `extracted`), `device_tokens`, `audit_log`, **`profiles.context`** (JSONB —
occupation/employer + benefit facts), **`benefit_patterns`** (crowd-learned employer/occupation→benefit
aggregates for the shared catalog), and the **CA portal**: `cas`,
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
- **Landing page (Oct 2026, D-48)** (`app/page.tsx`) — dream-first story, fully bilingual via its own `COPY.en/hi`
  (no AI needed): 3D money-brain hero (`BrainScene` with demo dreams) → animated chat demo (EN/Hinglish/Hindi) → demo
  `DreamCard`s → how it works (+ `MoneyFlow`, `AwayFeed`) → background engines → voice → future-you slider → pricing →
  "What's your dream?" box (saved to localStorage `paywatch_pending_dream`; the Overview captures it via
  `POST /brain/capture` right after sign-in). EN/हिं toggle in nav; signed-in users see "Open my app". Logo clicks from
  inside the app go to `/?home=1` (AuthRedirect skips the auto-redirect so the home page shows). Older notes: aurora gradient hero + floating blobs, 3D
  tilt score card, animated count-up **Gauge**, scroll-reveals (`.pw-reveal` + IntersectionObserver),
  glass feature showcase, an **interactive "cost of waiting"** projection (monthly slider → 10yr idle vs
  PayWatch FV, illustrative/compliant), animated stat counters, gradient pricing + CTA. Brand gradient/motion
  tokens live in `globals.css`: `.pw-aurora .pw-glass .pw-gradient-text .pw-shimmer-cta .pw-blob .pw-float2
  .pw-reveal` (all respect `prefers-reduced-motion`; `.pw-reveal` force-shows). Logo = `Logo.tsx`
  (`LogoMark` ascending ledger bars + `Wordmark` "Pay·Watch"). Copy stays in the education/organisation lane.
- **Loading / motion system** (engagement): `components/Skeleton.tsx` = `Skeleton/SkeletonCard/SkeletonList/
  PageSkeleton` + `WittyLoader` + **`LoadingScreen`** (big centred animated gauge + rotating sarcastic caption
  that crossfades away when `loading` flips false — used inside a `relative min-h-[60vh]` wrapper with content
  gated on `!loading`; wired into actions/insurance/tax/invest/networth/markets/reports pages). **DEFERRED**:
  `LoadingScreen` only reveals if `loading` is still true after `delayMs` (default 200ms), so fast/cached
  loads never flash a curtain — it appears ONLY when data genuinely takes a moment. `components/
  WelcomeSplash.tsx` = "Hello, {name}" splash once per app-open (sessionStorage `paywatch_greeted`).
  **`components/NavTransition.tsx`** = lightweight GLOBAL nav feedback in the app layout: just a thin top
  progress bar (`pw-navbar`) that flashes briefly on each `usePathname` change (skips first mount). NOT a
  full-screen curtain — the big contextual curtains are per-page via the deferred `LoadingScreen`, so nothing
  is forced on fast navigations. (`lib/quips.ts` `quipsForPath()` route→quips map exists for optional reuse.)
  Animations in `globals.css` (`pw-splash/pw-splash-leave`,
  `pw-ring-draw`, `pw-sweep`, `pw-fade-up`, `pw-page-in`, `pw-navbar`, `pw-skeleton`) all respect
  `prefers-reduced-motion` (global disable) with JS safety-timeouts so curtains never get stuck. CA portal
  (`/ca/*`, separate layout) not yet wired.

---

## 6. Mobile apps — NATIVE (Expo / React Native) in `mobile/` — see `mobile/README.md` (D-52, Oct 2026)
- **Replaces the Capacitor wrapper** (which caused sizing/scaling issues and risked Apple 4.2 / Play webview rejection).
  `mobile/` is a separate native codebase: Expo SDK 58, React Native 0.88, expo-router (file routes in `mobile/app/`),
  TypeScript; same API (`EXPO_PUBLIC_API_URL`, default `https://api.paywatch.in/v1`), same accounts and data.
  Old `web/android`, `web/ios`, `capacitor.config.ts`, `lib/native.ts` are legacy — retire once the native app ships.
- **Structure:** `app/_layout.tsx` (providers, auth gate via `Stack.Protected`: welcome/login → onboarding → app;
  splash; optional biometric lock; floating assistant `GuideCard`), `app/(tabs)/` = Home · Dreams · Ask · Alerts · More,
  `app/voice.tsx` (full-screen voice modal), sub-screens `networth invest insurance/{index,market} tax/{index,file}
  actions markets records statement vault ca/{index,[id]} reports plans settings legal/[doc]`.
  `src/lib/`: `api.ts` (SecureStore tokens, single-flight refresh, GET cache, `onDataChanged` bus), `auth.tsx`,
  `i18n.tsx` (hand-translated core + **auto-translate any `<Txt>` via `/i18n/translate`**, cached on device),
  `assistant.tsx` (shared conversation, `runActions`, guide), `routes.ts` (server web paths → native routes),
  `voice.ts` (expo-audio record + metering VAD → `/voice/stt`; fallback expo-speech-recognition; TTS `/voice/tts` mp3 →
  expo-audio, fallback expo-speech), `files.ts` (document picker → base64, `/files/parse`, share sheet),
  `format.ts` (Indian grouping by hand, not Intl), `theme.ts`, `recordTypes.ts`, `india.ts`.
  `src/components/`: `ui.tsx` (kit: Txt/Screen/Card/Button/Input/MoneyInput/Select sheet/Segmented/Disclosure/Orb…),
  `brain.tsx` (DreamCard, NextMoves, MoneyFlow, AwayFeed, FutureYou, PriceGuide, ScoreCard), `charts.tsx`, `Markdown.tsx`, `GuideCard.tsx`.
- **Server support:** `POST /v1/files/parse {name, base64, kind:'statement'|'holdings'|'capital_gains'|'text', docType?}`
  (`services/fileParse.ts` — same heuristics as `web/src/lib/statementParse.ts`; pdfjs-dist + xlsx loaded lazily via a
  real ESM import; body limit 12 MB for this route and `/voice/stt`). Nothing is stored by this route.
- **Store compliance baked in:** native UI everywhere; in-app account deletion (Settings → App); **no in-app sale of
  digital subscriptions** (Plans screen is informational, no buy buttons/links — Apple 3.1.1 / Play Billing);
  iOS privacy manifest + usage strings (mic, speech, Face ID); Android permissions minimal (RECORD_AUDIO, biometric,
  notifications; storage/location/camera/phone/foreground-service blocked); no background audio; `allowBackup=false`;
  `ITSAppUsesNonExemptEncryption=false`. Push gated by `EXPO_PUBLIC_PUSH_ENABLED=1` (needs Firebase/APNs).
- **Build/run (Mac):** `cd mobile && npm install && npx expo install --fix && npx expo start`; dev/prod builds via EAS
  (`eas build -p android|ios --profile development|production`, `eas submit`). Bundle id / package `in.paywatch.app`.
- **Keeping mobile in sync:** it's a second UI, so new web features need a native screen too. Shared logic lives on
  the server (brain, tax, insurance, assistant actions), so most changes are server-side and both apps get them.
- Verify: `cd mobile && npx tsc --noEmit` (and `npx expo export -p ios --no-bytecode` bundles all 1,500 modules).

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
  `CRON_SECRET`, **`ELEVENLABS_API_KEY`+`ELEVENLABS_VOICE_ID`+`ELEVENLABS_VOICE_ID_HI`** (opt — natural voice; HI auto-picked if blank), **`SARVAM_API_KEY`** (+opt `SARVAM_SPEAKER_HI`, `SARVAM_TTS_MODEL`) for native Hindi voice, `TRANSLATE_MODEL`(opt), `EMAIL_PROVIDER`(dev/resend)+`RESEND_API_KEY`+`EMAIL_FROM`, `APP_URL`,
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
- **Investing (SEBI + AMFI) — CHOSEN NEAR-TERM PATH: AMFI Mutual Fund Distributor (ARN).** To move Invest
  from category-only guidance to letting users actually invest in named funds/SIPs, become an **AMFI-registered
  MFD** (NISM Series V-A exam + ARN, ~₹3–5k — low barrier) and route transactions through **BSE StAR MF** (via
  infra like Cybrilla/FintechPrimitives, MfAPIs, or smallcase). MFD = distribution (trail commission from AMCs),
  NOT advice — do **not** charge advisory fees (that's SEBI RIA) and never name individual **stocks** (finfluencer
  rule). ARN is mutual-funds only; **stocks/ETFs need a SEBI stockbroker** — offer later only via a broker partner
  (e.g. smallcase gateway, execution at the user's own broker). Interim (no licence): keep category-only + an
  execution **hand-off**. Alternative for direct plans: SEBI **Execution-Only Platform (EOP)** registration.
- **CAs / advisor feature (ICAI) — legality clarified: keep it a PRIVATE user↔own-CA tool, NEVER a marketplace.**
  ICAI bans CA **advertising/solicitation**, **listing on app-based aggregators for exclusive services**, and
  **fee-sharing with non-members**. Our CA portal is a code-based handshake where a user connects their *own* CA
  and shares documents — that's fine. Do **NOT** build a CA discovery/listing/quotes marketplace, and **never take
  commission from CAs** (monetise the user, not the CA). If discovery is ever wanted, point to ICAI's own CA
  Connect portal.
- **Insurance — NEAR-TERM MODEL (refined with owner, Jul 2026): tech + discovery layer ON TOP OF a licensed
  partner.** PayWatch builds the whole experience (education, needs discovery, comparison-style UX, policy
  management) but the **regulated sale is owned by a licensed insurance partner** (embedded-insurance infra such
  as Zopper / Riskcovry, or a broker) via their quote/issue APIs — go live WITHOUT our own licence first, validate
  demand, then decide the licence path (broker for full comparison/advice, corporate agent for limited insurer
  sales, or web aggregator). **Compliance wording rule (enforced in UI):** never "best plan for you / we
  recommend / we're your advisor / cheapest & best in India". Use "options based on the details you provided,
  arranged through our IRDAI-licensed insurance partner, subject to insurer terms/underwriting/disclosures — not
  advice". Marketplace copy already updated: badge "★ Matches your inputs" (not "Recommended"), "Lowest indicative
  premium here" (not "Best-priced for you"), submit CTA "Continue with our licensed partner", plus a disclaimer
  banner on the plans list. Do NOT directly sell, collect premium into our account, or take commission
  outside a permitted structure until licensed/partnered. Longer-term the owner may still pursue the
  **Corporate Agent** licence below (own the margin) or design toward **Bima Sugam**.
- **Insurance — LONGER-TERM OPTION: Corporate Agent, end-to-end in-app (CRED model).**
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
0. **Incubation** ✓ — MAHE Innovation Centre (mentor assigned; help offered on trademark, testing, registrations,
   workspace, interns). Now: recruit interns, start trademark, validate with users.
1. **Company** — incorporate Pvt Ltd, PAN/TAN (CA/CS). Update legal copy CIN/address. (Unlocks most tie-ups.)
2. **Trademark** "PayWatch" with IP India (classes 9 / 36 / 42) — start early via the IC, before heavy promotion.
2b. **AMFI Mutual Fund Distributor (ARN)** — NISM V-A exam + ARN; unlocks in-app fund/SIP investing via BSE StAR
   MF + trail commission. Cheapest "actually invest" step. See §8. (Stocks need a separate broker partner.)
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
- **Test suite:** `cd server && npm test` runs **216 assertions** (incl. `fileparse.test.ts`: CSV/holdings/capital-gains server parsing) (+ `translate.test.ts`: chunking, truncated-reply salvage, failure fallback) (incl. `brain.test.ts`, 44 checks: money map, planning maths
  round-trips, dreams waterfall, cascade, affordability, life events, next-moves ranking, engine-agreement) across `test/*.ts` (the script loops
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

> **LEGALITY (ICAI) — do not drift:** this is a **private user↔own-CA collaboration tool** (code-based handshake +
> document sharing), NOT a CA marketplace/directory. ICAI bans CA advertising/solicitation, aggregator listings for
> exclusive services, and fee-sharing with non-members. So: never add CA discovery/listing/ratings/quotes, and never
> take commission from CAs — monetise the user. See §8. The client already knows their own CA, so identity isn't
> "revealed" to strangers; that concern only applies to a marketplace, which we don't build.

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
