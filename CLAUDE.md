# PayWatch — Project Context & Long-Term Memory

> This file is the single source of truth for the PayWatch project. It is meant to be read first by
> any AI assistant (and any new human collaborator) before working on the codebase. Keep it updated
> when architecture, deployment, branding, or compliance decisions change.

Last updated: June 2026.

---

## 1. What PayWatch is

PayWatch (formerly "Personal CFO") is **India's personal-finance operating system** — one app that
knows a user's full financial picture (income, savings, investments, loans, insurance, taxes) and
tells them exactly what to do next, in beginner-friendly language.

**Regulatory positioning (critical — never drift from this):** PayWatch is a **financial education
and organisation** tool. It is **NOT** a SEBI-registered Investment Adviser. It must never recommend
a specific stock, mutual-fund scheme, AMC, or product. It gives only asset-class / fund-**category**
guidance ("a large-cap index fund", "ELSS", "a liquid fund"), gap analysis vs published planning
standards, and tax/insurance education. The owner holds **no advisory licence**, so every
money-related feature is built to stay inside this education lane, with disclaimers throughout.

---

## 2. Architecture

```
PayWatch/
├── server/   Express + TypeScript API · PostgreSQL · port 4000
└── web/      Next.js 14 (App Router) PWA · Tailwind · port 3000
```

- **Money values are stored in paise everywhere** (₹1 = 100 paise) to avoid float errors. The web
  `inr()` helper formats paise → ₹.
- **Auth:** mobile OTP (+91), JWT 15-min access + 90-day rotating refresh token, lockout after 3
  failed attempts. Tokens stored in `localStorage` under `paywatch_access` / `paywatch_refresh`.
- **Audiences:** supports both working professionals and **students (age ~19-23)**. `employment_type`
  includes `'student'` (DB CHECK constraint swapped idempotently in schema.sql). Onboarding adapts for
  students (money-you-get framing instead of salary bands, skippable loans/insurance, reassurance copy).
  Students see no life-insurance pressure, no tax pressure below the threshold, and a "start investing
  small / index funds before individual stocks" action (ACT-013) — all still SEBI-compliant (no named products).

### Server (`server/src`)
- `index.ts` — Express app, route mounting, `/v1/health`.
- `config.ts` — all env config (DATABASE_URL, JWT secrets, SMS/billing/AA providers, ANTHROPIC key).
- `db/schema.sql` — full schema, **idempotent** (`CREATE TABLE IF NOT EXISTS`, `ALTER … ADD COLUMN IF NOT EXISTS`).
- `db/migrate.ts` (dev, via tsx) and the compiled `dist/db/migrate.js` (prod) run this schema.
- `routes/` — auth, user, score, actions, insights (networth/tax/insurance/invest/statements/spend), goals, qa, billing, compliance, aa, reports.
- `services/`:
  - `score.ts` — Money Health Score: 6 weighted dimensions (savings 25%, insurance 20%, diversification 20%, emergency fund 15%, debt 10%, tax 10%); unavailable dimensions are excluded and weights renormalised. **Student/young-user aware:** insurance dimension is excluded for students and life-cover is not required when `dependents_count === 0` (health-only); tax-efficiency is excluded below ~₹12.75L income (no tax under the new-regime rebate).
  - `tax.ts` — FY2025-26 old vs new regime, deduction tracker, **`taxReductionPlan()`** (beginner steps + rupee impact + capital-gains explainer + checklist + glossary), `marginalRate()`.
  - `insurance.ts` — 25× income term rule, health floater sizing, **personalised "what to get" recommendations + "what to avoid"**.
  - `investment.ts` — **SEBI-compliant investment guidance**: risk profile, target allocation, fund-category recommendations, model portfolios, monthly SIP plan. Never names a product.
  - `statement.ts` — **bank-statement analyser**: takes parsed transactions, returns category breakdown, invested total, recurring subs, reduce suggestions, watch-outs.
  - `networth.ts` — asset/liability breakdown, allocation, `growthProjection()` ("grow net worth from X to Y").
  - `actions.ts` — rule engine ACT-001…ACT-012, quantified actions.
  - `goals.ts`, `cfo-ai.ts` (RAG-grounded "Ask your CFO"), `rag.ts` (local Postgres FTS RAG store), `profile.ts` (loads ProfileData + recalc score).
- `adapters/` — `sms.ts` (dev logs OTP / msg91 real), `aa.ts` (Account Aggregator mock / Finvu), `billing.ts` (sandbox / Razorpay).

### Web (`web/src`)
- `app/onboarding/page.tsx` — 3-session progressive onboarding. State→City dependent dropdowns (`lib/india.ts`), risk-comfort question, "current value" clarifications.
- `app/(app)/` — dashboard, actions, networth, **invest**, tax, insurance, **statement**, goals, ask, reports, settings (all behind auth layout with sidebar nav).
- `lib/india.ts` — Indian states/UTs → cities, `isMetro()` for HRA.
- `lib/statementParse.ts` — **client-side** CSV/Excel/PDF parsing (loads PapaParse/SheetJS/pdf.js from cdnjs at runtime; the file never leaves the browser, only parsed rows are POSTed).
- `lib/api.ts` — fetch wrapper with auto token refresh. `lib/format.ts` — `inr()`, labels.
- `components/Logo.tsx` — `LogoMark` (three ascending bars icon) + `Wordmark` (renders "Pay*Watch*").

---

## 3. Branding decisions

- App name: **PayWatch** (was "Personal CFO"). Wordmark renders `Pay` + italic `Watch`.
- **Kept intentionally:** the "**Ask your CFO**" feature name and the "**CFO**" plan tier (the `cfo`
  plan key is used in DB + billing). "CFO" there is an advisor-role metaphor / tier name, not the brand.
- Company name in legal copy: "PayWatch Technologies Pvt. Ltd." (placeholder — update with real CIN/address).
- Emails: `support@paywatch.in`, `grievance@paywatch.in`. GST invoice prefix: `PAYW/FY/NNNNN`.
- The `PersonalCFO_SRS_v2.docx` spec file and the repo folder name were left unchanged on purpose.

---

## 4. Deployment

- **Source:** GitHub `yashcodingprodigy/PersonalCFO`, branch `main`. Push → auto-deploys.
- **API:** Railway service "PersonalCFO" (Node/Express, built from `server/`). Start = `node dist/index.js`.
  - **Pre-Deploy Command = `npm run migrate:prod`** → runs the compiled, idempotent migration before
    every deploy (no dev deps needed; `build` copies `schema.sql` into `dist/db/`). This is why we
    no longer migrate by hand for additive changes.
- **DB:** Railway Postgres service. `DATABASE_URL` is injected into the API service.
- **Web:** Vercel (Next.js from `web/`). Env `NEXT_PUBLIC_API_URL` (baked at build → must redeploy on change).
- **Domain:** `paywatch.in` (registrar: **GoDaddy**, nameservers `ns05/ns06.domaincontrol.com`).
  - Apex `A @ → 76.76.21.21` (Vercel). `CNAME www → cname.vercel-dns.com`. `CNAME api → <Railway target>`.
  - GoDaddy email records (MX secureserver.net, SPF, DKIM `*._domainkey`, DMARC, autodiscover) must be left intact.
  - **CORS:** server reads `CORS_ORIGIN` (comma-separated). Must include `https://paywatch.in,https://www.paywatch.in`.
- **Env vars to remember:** Railway → `DATABASE_URL`(auto), `JWT_SECRET`, `JWT_REFRESH_SECRET`,
  `CORS_ORIGIN`, `NODE_ENV=production`, `SMS_PROVIDER`, `BILLING_PROVIDER`, `AA_PROVIDER`,
  `ANTHROPIC_API_KEY` (optional). Vercel → `NEXT_PUBLIC_API_URL`.

### Common deploy gotchas
- **"Failed to fetch" on login** = CORS or API URL, NOT DNS propagation. Fix: ensure `CORS_ORIGIN`
  includes the visited origin, and `NEXT_PUBLIC_API_URL` points to a reachable API (`/v1/health` returns ok),
  then **redeploy Vercel** (the URL is build-time baked).
- Changing `NEXT_PUBLIC_API_URL` requires a Vercel **redeploy** to take effect.
- Non-additive DB changes (drop/rename/type change) are NOT handled by the idempotent re-run —
  **pause deploys and run the specific SQL by hand**, or adopt a real migration tool.

### Reset the database (fresh start)
Run in Railway Postgres query editor (keeps the seeded knowledge base):
```sql
DELETE FROM users;       -- cascades to all per-user tables
DELETE FROM otp_codes;
DELETE FROM audit_log;
```
For a total wipe also `DELETE FROM rag_documents;` then re-seed with `DATABASE_URL=… npm run seed`.

---

## 5. OTP behaviour
- OTP is **never returned to the client** — it's read from **server logs** (Railway logs) in dev mode,
  or sent via SMS when `SMS_PROVIDER=msg91`.
- Value: fixed `424242` when `NODE_ENV !== production`; random 6-digit when `NODE_ENV=production`.

---

## 6. Local dev
```bash
createdb paywatch
cd server && cp .env.example .env && npm install && npm run migrate && npm run seed && npm run dev
cd ../web && npm install && npm run dev
```
Verify types: `cd server && npx tsc --noEmit` · `cd web && npx tsc --noEmit`.

---

## 7. Compliance posture (India)
- **SEBI:** education/organisation only; never name a security; no real-time stock tips. (Finfluencer
  rule: a pure-education entity must not use the last 3 months' price data alongside a security name —
  PayWatch names no securities, so it stays clear.) Specific paid advice would require SEBI RIA registration.
- **DPDP Act 2023 + DPDP Rules 2025** (Rules notified 13 Nov 2025; ~18-month phased compliance):
  PayWatch is a Data Fiduciary. Built: consent ledger, JSON export, hard delete, AA revocation, audit log.
  Still to formalise: standalone consent notice, breach-reporting process (to Data Protection Board +
  users), grievance officer, verifiable parental consent for under-18 users, documented security safeguards.
- **RBI Account Aggregator:** pulling live bank data in production requires becoming an **FIU**
  (register via Sahamati + an AA/TSP gateway like Finvu). Until then keep `AA_PROVIDER=mock` and rely on
  the statement-upload feature.
- **IT Rules 2021:** grievance officer + mechanism (referenced on the Disclosures page).
- **Payments:** Razorpay is the payment aggregator; PayWatch is just a merchant (needs Razorpay KYC, not a PA licence).

---

## 8. Roadmap

### Goal A — Mobile apps (Android + iOS)
Recommended path: **Capacitor** wrapping the existing web UI, plus native features to satisfy Apple's
"minimum functionality" rule (biometric app-lock, push notifications, offline shell). Alternative:
rebuild the UI in **React Native / Expo** (more durable, more work). See chat notes / section 9 for steps.
Both stores need an **organisation developer account + D-U-N-S number** (financial category). Start the
D-U-N-S request early (up to ~30 days). Apple: $99/yr, needs legal entity + matching-domain email +
live website (paywatch.in ✓). Google: $25 one-time. PayWatch is NOT a lending app, so the RBI
"digital lending app" allow-list rule does not apply, but expect extra scrutiny for the finance category.

### Goal B — Registrations & certifications (priority order)
1. **Business entity** — incorporate a Pvt Ltd (or start as proprietorship/LLP for MVP), get PAN/TAN. (CA / company secretary.)
2. **Trademark** — file "PayWatch" wordmark with IP India (classes 9 / 36 / 42).
3. **GST registration** — required once charging subscriptions over the threshold or selling across states; the billing code already issues 18% GST invoices.
4. **DPDP baseline** — finalise privacy notice, grievance officer, breach plan, under-18 handling, security documentation.
5. **Developer accounts + D-U-N-S** — Apple & Google org accounts (start D-U-N-S now).
6. **Razorpay live KYC** — business docs + bank account for live subscriptions.
7. **AA / FIU** — only when moving off mock bank data.
8. **Legal review** — have a lawyer review Terms / Privacy / Disclosures and the SEBI education boundary.

> NOTE: The owner is new to this. None of section 7–8 is legal advice — engage a CA (entity, GST) and a
> lawyer (DPDP, SEBI boundary, terms). Verify every rule against the current official source before acting.

---

## 9. Working agreements / preferences
- Owner prefers concise, direct answers.
- For deployed changes, always call out DB-migration and env-var implications before they go live.
- Keep every money feature inside the education/organisation lane; add disclaimers on new surfaces.
