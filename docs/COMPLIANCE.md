# Compliance & Legal Checklist — PayWatch

Current compliance posture, split into **what's built**, **what we can do now (no authority licence
needed)**, and **what's deferred to a later phase (needs a complex licence/registration from an
authority)**. Not legal advice — have a CA and a fintech lawyer review before public launch.

Last updated: June 2026.

---

## 1. Built / implemented in code

| Area | Implementation |
|---|---|
| **Not SEBI advice** | Category-level guidance only — never a named stock/fund. AI guardrails (`services/cfo-ai.ts`) block specific-security recommendations via prompt + pattern rules. Disclaimers on dashboard, Invest, Markets, reports, and the public Disclosures page. Finfluencer rule respected (no <3-month price data beside a named security — we name none). |
| **Tax = prepare + self-file** | ITR wizard *prepares and computes* the return, picks ITR-1/2/3/4, and walks the user through filing on the official portal. Engine flags the rare audit-needs-a-CA case. Disclaimers on the File ITR flow + Disclosures page. Math covered by a test suite (`server: npm test`). |
| **GST on subscriptions** | 18% GST, inclusive pricing, sequential invoices (`PAYW/FY/NNNNN`), shown per invoice in Plans/Settings. |
| **DPDP data rights** | Standalone **consent notice at onboarding** (required checkbox) + **under-18 guardian consent** path, recorded in the consent ledger (`consents`). Full JSON export, hard delete (FK cascade), AA-revocation deletion, audit log, India data-residency commitment. Privacy policy + grievance email in app. |
| **Account Aggregator** | Consent explicit/granular/time-bound/revocable; revocation deletes AA data; never asks for credentials. Adapter `mock → finvu` (stays on `mock`). |
| **Security** | bcrypt-hashed OTPs, SHA-256 rotating refresh tokens, parameterised SQL, zod validation, helmet, rate limits, secret-protected cron, errors never leak internals. |
| **Disclosures** | Grievance Officer email on Disclosures + footer; referral links default to `null` (none live). |

---

## 2. Do now — no authority licence required (this phase)

These are drafting / policy / small-code tasks we can complete without waiting on any registration:

1. **Refresh the legal pages** for current features + DPDP Rules 2025 — Privacy, Terms, Disclosures.
   (Disclosures now covers the tax-filing positioning; review Privacy/Terms similarly.)
2. **Name a Grievance Officer and a DPO** (real person + email) on the Disclosures/Privacy pages
   (designation only — no authority approval needed).
3. **Standalone consent notice** at onboarding (DPDP) — clear purpose, itemised; the consent ledger
   already records it.
4. **Under-18 handling** — collect age (we do) and add a verifiable-parental-consent path / block for minors.
5. **Breach-response process** — a written runbook (notify the Data Protection Board + affected users);
   the `audit_log` + `notifications` plumbing already exists.
6. **Statement / Form-16 file handling** — files are parsed **on-device** and never uploaded (already true);
   document this in the privacy policy.
7. **Annual tax-law update** — slabs/limits live only in `services/tax.ts` + `services/taxFiling.ts`;
   update after each Finance Act and re-run `npm test`.
8. **Disclaimers on every new money surface** (filing, document generators) — keep adding as features grow.

---

## 3. Deferred — needs a complex licence / authority registration (next phase)

Park these until the app has been live a few months and the entity exists. None are code problems.

| Item | Authority / process | Gates |
|---|---|---|
| **Company incorporation** (Pvt Ltd) + PAN/TAN | MCA (via CA/CS) | Everything below; real CIN/address in legal copy. |
| **GST registration** | GST portal | Charging real subscribers. |
| **ERI registration** (e-Return Intermediary) | Income Tax Dept | True **one-click e-filing** from inside the app. Until then users self-file with our computation. |
| **AA / FIU registration** | Sahamati + Finvu (~₹50k, 2–3 mo) | Switching `AA_PROVIDER=finvu` for live bank data. |
| **Razorpay live KYC** | Razorpay (PA holds the licence) | Live paid subscriptions. |
| **Trademark "PayWatch"** | IP India (classes 9/36/42) | Brand protection (optional but advised). |
| **Developer org accounts + D-U-N-S** | Apple / Google / D&B | App Store + Play Store (finance category). Start D-U-N-S early. |
| **CERT-IN empanelled pen-test** | CERT-In empanelled vendor | Annual, from Year 1. |
| **SEBI RIA** | SEBI | *Only if* we ever give specific paid investment advice — current design avoids this. |
| **AMFI ARN / IRDAI POSP** | AMFI / IRDAI | *Only if* we enable paid mutual-fund / insurance referral links (currently `null`). |
| **Tax audit / 15CB certification** | Chartered Accountant (by law) | Cannot be removed by software — engine flags these cases. |

---

## 4. Data-handling rules encoded in the system
- All money in **paise** (BIGINT) — no floating-point currency.
- OTPs: 6-digit, 10-min expiry, 3 attempts → 15-min lockout, stored hashed, never returned to the client.
- Uploaded statements / Form 16 are parsed **client-side**; only derived rows reach the server.
- Per-user RAG memories scoped to the user, cascade-deleted with the account.
- Analytics/ML must use anonymised aggregates only.
