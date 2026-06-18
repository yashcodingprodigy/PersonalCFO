# PayWatch — Demo Customer Personas (for testing)

15 diverse demo accounts to verify the app across incomes, ages, cities, family
situations, employment types, debt levels and risk profiles. Each is fully
populated (assets, liabilities, insurance, tax data) and lands straight on a
populated dashboard (onboarding is pre-marked complete).

## How to seed them

From the `server/` folder, pointed at whichever database you want to fill:

```bash
cd ~/Claude/Projects/PersonalCFO/server
DATABASE_URL="postgresql://postgres:...@db.scahpgtytthzjmmcbqxg.supabase.co:5432/postgres" npm run seed:personas
```

Safe to re-run (it updates the same accounts by mobile number). It prints each
persona's Money Health Score as it seeds.

## How to log in

1. Open the app → Login, enter the persona's mobile number (e.g. `+919000000002`).
2. Get the OTP:
   - **Deployed app (Railway):** open Railway → your API service → Deployments →
     View Logs, and find the line `[sms:dev] OTP for +919000000002: 837412`. Enter it.
   - **Running locally (`npm run dev`, not production):** the OTP is always `424242`.
3. You're in — the dashboard shows that persona's score, net worth and actions.

> These are fake numbers (`+9190000000xx`) — with `SMS_PROVIDER=dev` no real SMS
> is sent; the OTP only appears in your server logs. Don't seed these into a
> database that's sending real SMS.

## The personas

| # | Mobile | Name | Age | City | Type | Income | Plan | What it exercises |
|---|--------|------|-----|------|------|--------|------|-------------------|
| 1 | +919000000001 | Aarav Sharma | 26 | Bengaluru | Salaried | ₹28L | Starter | High earner, **no dependents** → no term needed, aggressive investing, new-regime tax |
| 2 | +919000000002 | Priya Nair | 34 | Mumbai | Salaried | ₹18L | **CFO (Plus)** | Married + 2 kids + home loan + **zero term cover** → #1 high-priority gap; Plus badge |
| 3 | +919000000003 | Rohan Mehta | 41 | New Delhi | Business | ₹45L | CFO | ~₹4.4Cr net worth, **property-concentrated** → diversification penalty; term gap |
| 4 | +919000000004 | Sneha Reddy | 22 | Hyderabad | **Student** | ₹3L | Starter | Student framing — insurance & tax **excluded**; "start small / index funds" |
| 5 | +919000000005 | Vikram Singh | 38 | Pune | Salaried | ₹32L | CFO | **Well-balanced benchmark** (score ~90); old-vs-new regime close; NPS done |
| 6 | +919000000006 | Ananya Iyer | 29 | Chennai | **Freelancer** | ₹14L | Starter | 44ADA presumptive, **no emergency fund**, no health cover, high card use |
| 7 | +919000000007 | Karthik Krishnan | 45 | Kochi | Salaried | ₹22L | Starter | Sole earner, **3 dependents + senior parents** → term gap, 80D senior parents |
| 8 | +919000000008 | Meera Joshi | 31 | Ahmedabad | Salaried | ₹16L | Starter | **Debt-stressed**: personal+car loan + 90% card use → poor debt health |
| 9 | +919000000009 | Arjun Patel | 52 | Surat | Business | ₹60L | **Family** | **~₹6.5Cr** net worth, low equity, retirement & estate focus |
| 10 | +919000000010 | Divya Menon | 27 | Kolkata | Salaried | ₹9L | Starter | **Below tax threshold** (tax dim off), first-time investor |
| 11 | +919000000011 | Rahul Verma | 36 | Jaipur | Salaried | ₹20L | CFO | Classic **"prepay home loan vs invest?"** Ask-CFO scenario |
| 12 | +919000000012 | Fatima Khan | 30 | Lucknow | Salaried | ₹12L | Starter | **Single parent**, 1 dependent, no term cover → term gap |
| 13 | +919000000013 | Sanjay Gupta | 48 | Indore | Self-employed | ₹15L | Starter | Shopkeeper, **no insurance at all**, gold-heavy → weak score |
| 14 | +919000000014 | Nisha Agarwal | 24 | Noida | Salaried | ₹7.5L | Starter | **First job**, education loan (80E), building from zero |
| 15 | +919000000015 | Ramesh Pillai | 58 | Thiruvananthapuram | Salaried | ₹26L | CFO | **Near retirement**, debt-heavy allocation, low equity, retirement corpus |

## Expected results (sanity check)

Computed live from the seeded data — your dashboard should match closely:

| Name | Score | Net worth | Top action |
|------|-------|-----------|------------|
| Aarav Sharma | 76 | ₹18.6L | Invest ₹50,000 in NPS Tier-1 for extra deduction |
| Priya Nair | 69 | ₹61.8L | Increase your term life cover |
| Rohan Mehta | 87 | ₹4.44Cr | Increase your term life cover |
| Sneha Reddy | 70 | ₹80,000 | Step up your SIP |
| Vikram Singh | 90 | ₹1.66Cr | Increase your term life cover |
| Ananya Iyer | 49 | ₹5.7L | Raise your family health cover |
| Karthik Krishnan | 80 | ₹1.06Cr | Increase your term life cover |
| Meera Joshi | 50 | −₹7.0L | Build emergency fund |
| Arjun Patel | 87 | ₹6.54Cr | Increase your term life cover |
| Divya Menon | 70 | ₹3.5L | Step up your SIP |
| Rahul Verma | 88 | ₹70.8L | Increase your term life cover |
| Fatima Khan | 62 | ₹6.2L | Increase your term life cover |
| Sanjay Gupta | 40 | ₹83.0L | Increase your term life cover |
| Nisha Agarwal | 66 | −₹3.0L | Build emergency fund |
| Ramesh Pillai | 88 | ₹2.75Cr | Increase your term life cover |

## What to check per account

- **Overview:** score gauge + 6 dimensions, net-worth growth comparison, top actions.
- **Actions:** priorities/filters; "Mark done" flow updates the profile + recalculates.
- **Tax:** regime comparison (old-regime users 2/5/7/11 should show a real choice; sub-threshold users 10/14 should say "no tax to optimise").
- **Insurance:** term/health rings + rounded "target" ranges (e.g. Priya's term target).
- **Invest:** allocation matched to risk (Aarav aggressive vs Ramesh conservative).
- **File ITR / Net worth / Ask your CFO:** try "Should I prepay my home loan or invest?" on Rahul (#11).
- **Student (#4)** and **sub-threshold (#10, #14):** confirm insurance/tax are gracefully excluded, not zeroed.

## Removing the demo accounts later

```sql
DELETE FROM users WHERE mobile LIKE '+91900000000%';
```
(Cascades to their profiles, scores, actions, etc.)
