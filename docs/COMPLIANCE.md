# Compliance & Legal Checklist — Personal CFO

How the build implements SRS §23–24, and what must be done **before public launch**.

## Implemented in code

| Requirement | Implementation |
|---|---|
| Not SEBI investment advice | Category-level guidance only. AI guardrails (`server/src/services/cfo-ai.ts`) block specific stock/scheme/crypto recommendations via pattern matching *and* system-prompt rules. Disclaimer on every AI answer, dashboard, report, and the public Disclosures page. |
| Citations | Every KB document carries a source tag (`IT Act FY2025-26`, `IRDAI guideline`, `SEBI IA Regulations 2013`, `Standard planning rule`); answers surface them as chips. |
| Human review layer (SRS §12.1) | Recommendation-shaped answers on CFO/Family plans are stored `pending_review` and labelled in the UI for advisor review. |
| GST | 18% on all subscriptions, inclusive pricing, sequential invoice numbers (`PCFO/FY/NNNNN`), GST shown per invoice in Settings. |
| DPDP Act 2023 | Plain-English privacy policy, full JSON export, hard delete with FK cascade, consent ledger (`consents` table), audit log, India data-residency commitment. |
| AA framework (SRS §16) | Consent is explicit, granular, time-bound (12 months), revocable; revocation deletes AA-sourced data immediately. No credentials ever requested. Adapter pattern: `mock` → `finvu`. |
| Security (SRS §23) | bcrypt-hashed OTPs, SHA-256-hashed rotating refresh tokens, parameterised SQL everywhere, zod input validation (whitelist), helmet headers, rate limiting on auth + API, no unauthenticated endpoints beyond login, errors never leak internals. |
| Plan limits | Enforced server-side (Starter: 5 questions/month, 2 goals) — not just hidden in UI. |
| Referral disclosure | `referral_link` on actions renders with an explicit "we may earn a disclosed commission" label. |
| Grievance mechanism | grievance@personalcfo.in on Disclosures page + footer (IT Rules 2021). |

## Required before public launch (cannot be done in code)

1. **GST registration** — before the first paid subscriber (Day 1).
2. **Legal opinion** on SEBI positioning from a fintech law firm (SRS §31 mitigation).
3. **AMFI ARN** (NISM Series V-A exam, 4–8 weeks) — *before* enabling any mutual fund referral links.
4. **IRDAI POSP-Life and POSP-General** (15-hour training + exam each) — *before* enabling insurance referral links. Until then keep `referral_link = null` (current default).
5. **AA FIU registration** via Sahamati (~₹50,000, 2–3 months) — before switching `AA_PROVIDER=finvu`.
6. **Razorpay live activation** (KYC, website checks) — Razorpay holds the PA licence so no RBI PA registration is needed.
7. **CERT-IN empanelled penetration test** — annual, from Year 1.
8. **Company formation & registered office** — invoice and policy pages reference Personal CFO Technologies Pvt. Ltd.; update with real CIN/address.
9. **Appoint a Grievance Officer** by name (IT Rules 2021) and a DPO contact (DPDP).
10. **Annual tax-law update** — slabs/limits live only in `server/src/services/tax.ts`; update after each Finance Act and re-seed the knowledge base.

## Data handling rules encoded in the system

- All money in **paise** (BIGINT) — no floating-point currency anywhere.
- OTPs: 6-digit, 10-minute expiry, 3 attempts then 15-minute lockout, stored hashed.
- Statement files (when PDF parsing is added): delete within 24 hours of parsing — mirror the AA-revocation deletion job.
- Analytics/ML must use anonymised aggregates only; per-user RAG memories are scoped to the user and cascade-deleted with the account.
- Employer (B2B2C) dashboards must aggregate with **minimum N=10** before exposure.
