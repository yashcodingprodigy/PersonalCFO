# Test persona — Aarav Sharma

A complete, internally-consistent fake user with documents in real formats, to exercise the whole app (uploads, AI reading, parsers, tax engine, insurance alerts, statement dashboard, score).

## Who he is

| Field | Value |
|---|---|
| Name | Aarav Sharma |
| Mobile | +91 9000000001 |
| Age | 31 |
| City / State | Bengaluru, Karnataka |
| Employment | Salaried — Senior Software Engineer, Nimbus Technologies Pvt Ltd |
| PAN | ABCPS1234K |
| FY of all docs | 2025-26 (AY 2026-27) |

**How to load him:** log in with mobile `9000000001` (dev OTP `424242`). Onboard as **Salaried**, Bengaluru, age 31, income band ₹20–35L, dependents 1. Then upload the documents below — they populate income, tax, spending, investments, insurance and the Money Health Score.

## The financial picture (what the docs add up to)

- **Salary:** ₹24,00,000 gross. New-regime Form 16 tax ₹2,67,540; total TDS ₹2,73,840 (salary + FD + dividend).
- **Rent paid:** ₹35,000/mo (HRA) — landlord PAN on the receipts.
- **Let-out flat (home loan):** interest ₹3,20,000 (24b), principal ₹1,80,000 (80C) → **house-property loss** (tests the ₹2L cap + carry-forward).
- **Other income:** bank/FD interest ₹60,000 (TDS ₹4,800), dividends ₹15,000 (TDS ₹1,500).
- **Capital gains:** net **LTCG +₹2,05,000** and net **STCG −₹30,000 (a loss)** → tests **STCL set off against LTCG**, then ₹1.25L LTCG exemption.
- **Demat holdings:** ₹8,48,400 across stocks, index/flexi/ELSS funds and an SGB.
- **Deductions:** 80C (EPF + ELSS, capped ₹1.5L), 80D ₹22,000, NPS 80CCD(1B) ₹50,000, employer NPS 80CCD(2) ₹96,000, 80G ₹11,000.
- **Insurance:** Term ₹1.5 Cr, Health ₹10L, Car (comprehensive). The **motor policy expires 15-Jul-2026** → should raise an **urgent renewal alert**.

## Documents (every one in a real format)

| # | File | Upload to | Key values the app should read |
|---|---|---|---|
| 01 | `01_offer_letter.pdf` | Monthly records → Employment contract | Role, joining 01-Jun-2021, CTC ₹24L |
| 02 | `02_salary_structure.pdf` | Monthly records → Salary structure letter | Basic 9.6L, HRA 4.8L, etc. |
| 03 | `03_payslip_mar2026.pdf` | Monthly records → Payslip | Basic 80k, HRA 40k, gross 2L, net 1,67,905, TDS 22,295 |
| 04–05 | `04_form16_partA.pdf`, `05_form16_partB.pdf` | Monthly records → Form 16 | Gross 24L, taxable 22,29,000, tax 2,67,540, TDS 2,67,540 |
| 06 | `06_form26as_ais.pdf` | Monthly records → Form 26AS/AIS | TDS 2,73,840; income summary |
| 07 | `07_bank_statement.csv` | **Statement scan** + Monthly records → Bank statement | 54 txns, in ₹5.2L, out ₹3.6L |
| 08 | `08_demat_holdings.csv` | Monthly records → Demat/MF holdings | 7 holdings, ₹8,48,400 |
| 09 | `09_capital_gains.csv` | Monthly records → Capital gains | net LTCG +2,05,000, net STCG −30,000 |
| 10 | `10_interest_certificate.pdf` | Monthly records → Interest certificate | Interest 60,000, TDS 4,800 |
| 11 | `11_dividend_statement.pdf` | Monthly records → Dividend statement | Dividend 15,000, TDS 1,500 |
| 12 | `12_home_loan_certificate.pdf` | Monthly records → Home-loan certificate | Interest 3,20,000, principal 1,80,000 |
| 13 | `13_rent_receipts.pdf` | Monthly records → Rent receipts | ₹35,000/mo, landlord PAN |
| 14 | `14_80C_elss_proof.pdf` | Monthly records → 80C proofs | ELSS ₹50,000 |
| 15 | `15_80D_health_premium.pdf` | Monthly records → 80D health | Premium ₹22,000 |
| 16 | `16_nps_statement.pdf` | Monthly records → NPS statement | 80CCD(1B) ₹50,000 |
| 17 | `17_80G_donation.pdf` | Monthly records → Donation 80G | ₹11,000 |
| 18 | `18_term_life_policy.pdf` | **Insurance** → Term life | Sum assured ₹1.5 Cr, premium ₹18,500 |
| 19 | `19_health_policy.pdf` | **Insurance** → Health | Sum insured ₹10L, renews 01-Sep-2026 |
| 20 | `20_motor_policy.pdf` | **Insurance** → Motor | IDV ₹6.5L, **expires 15-Jul-2026** → urgent alert |

## What to verify after uploading

- **Tax page → Full computation:** all income heads populated; form selected (ITR-2 — has capital gains + let-out property); STCL offsets LTCG; house-property loss applied (≤₹2L) with any excess in *carry-forward*; TDS reconciled to a refund/payable.
- **Insurance:** cover rings reflect ₹1.5 Cr term + ₹10L health; **Alerts** shows an *urgent* motor-renewal alert.
- **Statement scan:** spending dashboard (donut, top merchants, "where you could've saved").
- **Monthly records:** the per-month "X of Y uploaded" progress climbs as you add docs.
- **Money Health Score / Actions:** update after each upload.

*All names, PANs, account and policy numbers are fictitious and for testing only.*
