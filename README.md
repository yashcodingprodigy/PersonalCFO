# PayWatch

India's personal finance operating system — one app that knows your full financial picture and tells
you exactly what to do next. Built from `PersonalCFO_SRS_v2.docx`.

## Architecture

```
PayWatch/
├── server/   Express + TypeScript API · PostgreSQL · port 4000
└── web/      Next.js 14 PWA · Tailwind · port 3000
```

| Layer | Implementation |
|---|---|
| Auth | Mobile OTP (+91), JWT 15-min access + 90-day rotating refresh, lockout after 3 attempts |
| Money Health Score | 6 dimensions, exact SRS §6 weights & curves, versioned history with profile snapshots |
| Action Engine | Rules ACT-001…ACT-012 (SRS §7.3); auto-resolves when the trigger condition clears; completions/skips feed the AI personalisation layer |
| Tax engine | FY2025-26 old vs new regime comparison, 80C/80CCD(1B)/80D/24(b)/HRA tracker, tax calendar — law constants isolated in one file for annual updates |
| Insurance analyser | 25× income term rule, family floater + super top-up guidance, severity flags |
| Net worth | Asset/liability breakdown, allocation, liquidity ratio, ₹1 Cr projection |
| Goals | Inflation-adjusted SIP maths, on-track/at-risk/off-track health |
| Ask Your CFO | RAG-grounded Q&A: **local retrieval** (Postgres FTS, per-user private store + global knowledge base) + Claude API generation with a deterministic rules-engine fallback. SEBI guardrails block specific-security recommendations at both prompt and pattern level |
| Billing | Plan tiers per SRS §15 with enforced limits (5 questions/mo, 2 goals on Starter), sandbox Razorpay adapter, sequential GST invoices (18%) |
| Compliance | Consent ledger, full JSON data export, hard account deletion, AA consent revocation with data deletion, audit log |
| Reports | Monthly report (SRS §14) — print-ready, browser print = PDF |

### The AI personalisation layer ("trained eventually")

Every user has a **private RAG store** in PostgreSQL. The system writes memories on every question
asked, every action completed or skipped, and every transaction-category correction. Retrieval runs
locally (full-text search — no user data sent to any embedding API); only the final composed prompt
goes to the Claude API, and with no `ANTHROPIC_API_KEY` the built-in deterministic engine answers
entirely offline. Swapping FTS for pgvector + local embeddings is a drop-in upgrade on the same table.

## Run locally

```bash
# 1. PostgreSQL (any 14+) — create a database
createdb paywatch

# 2. API
cd server
cp .env.example .env          # defaults work for local dev
npm install
npm run migrate && npm run seed
npm run dev                   # http://localhost:4000

# 3. Web
cd ../web
npm install
npm run dev                   # http://localhost:3000
```

Sign in with any Indian mobile number — in dev mode the OTP is **424242** (printed to the server logs, never shown on screen).
On the dashboard, press **"Connect bank accounts"** to load simulated Account Aggregator data and
watch the score update.

## Deploy (Vercel + Railway)

1. **Railway**: create a PostgreSQL instance + a service from `server/` (`npm run build`, start
   `node dist/index.js`). Set `DATABASE_URL` (auto), `JWT_SECRET`, `JWT_REFRESH_SECRET`,
   `CORS_ORIGIN=https://yourdomain`. Run `npm run migrate && npm run seed` once.
2. **Vercel**: import `web/`, set `NEXT_PUBLIC_API_URL=https://<railway-app>.up.railway.app/v1`.
3. Going live with real integrations — set in `server/.env`:
   - `SMS_PROVIDER=msg91` + MSG91 keys (real OTP SMS)
   - `BILLING_PROVIDER=razorpay` + Razorpay keys & plan IDs (live subscriptions)
   - `AA_PROVIDER=finvu` + Finvu credentials (requires FIU registration — see docs/COMPLIANCE.md)
   - `ANTHROPIC_API_KEY` (Claude-generated answers; omit to stay on the offline rules engine)

## Compliance posture

See `docs/COMPLIANCE.md`. Summary: the product is positioned as financial **education and
organisation** (not SEBI investment advice), AI answers carry source tags and disclaimers and are
pattern-blocked from naming securities, prices include 18% GST with sequential invoices, data rights
follow the DPDP Act 2023 (export, erasure, granular revocable consent), and all monetary values are
stored in paise to avoid float errors.
