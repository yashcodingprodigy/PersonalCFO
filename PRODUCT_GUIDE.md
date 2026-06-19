# PayWatch — Complete Product Guide

> A page-by-page, feature-by-feature reference for presenting PayWatch. Every screen, every number, what it means, and exactly how it's calculated. Written so you can explain the app confidently to anyone.

---

## 0. What PayWatch is (the one-paragraph pitch)

PayWatch is **India's personal-finance operating system** — one app that knows a person's full financial picture (income, spending, savings, investments, loans, insurance, taxes) and tells them exactly what to do next, in beginner-friendly language. The hero feature is **Ask PayWatch**, an AI advisor grounded in the user's own numbers. PayWatch is a **financial education, organisation and tax-preparation** tool that **works alongside** the user's Chartered Accountant and advisor — it never claims to replace accountable professional advice. It is **not** a SEBI-registered Investment Adviser, so it only ever gives **category-level** guidance (e.g. "a large-cap index fund"), never a specific stock or scheme.

**Audiences:** working professionals AND students (~19–23). The app adapts (no insurance/tax pressure for students, "start small" investing framing).

---

## 1. Concepts you'll reference on every page

**Money is stored in paise.** ₹1 = 100 paise. Every figure in the app is computed in paise and formatted to ₹/lakh/crore for display. (You don't need to mention this when presenting — it's an engineering detail — but it's why the math is exact.)

**The Money Health Score (0–100)** is the spine of the app. It's a weighted average of **six dimensions**:

| Dimension | Weight | Measures |
|---|---|---|
| Savings rate | 25% | How much of take-home you keep |
| Insurance adequacy | 20% | Life + health cover vs. what you need |
| Investment diversification | 20% | Spread across asset classes |
| Emergency fund | 15% | Months of expenses in liquid savings |
| Debt health | 10% | EMI load + credit-card usage |
| Tax efficiency | 10% | Whether you've picked the better regime / used deductions |

**Key fairness rule:** if a dimension can't be measured for someone (e.g. a student has no insurance need, or income is below the tax threshold), that dimension is **excluded and the remaining weights are renormalised** — so people aren't penalised for things that don't apply to them. This is what makes one score work for a 22-year-old intern and a 52-year-old business owner.

**Return assumptions are conservative and risk-based** (used in projections): cautious **~7%**, balanced **~9%**, aggressive **~11%** per year (nominal, i.e. before ~6% inflation). These sit at or below long-run averages (equity ~11–12%, debt ~7%) on purpose — we under-promise.

**Compliance lane (say this if asked "is this legal?"):** education + organisation + tax preparation. No named securities (SEBI). Tax features *prepare and compute* returns and guide self-filing; audits/certifications still legally need a CA.

---

## 2. How data gets in (Onboarding)

Before any page has numbers, the user completes a **3-session onboarding** (state→city dropdowns, age, employment type, income, dependents, a risk-comfort question, and optional assets/liabilities/insurance/tax details). They can also "fill later." Everything the user enters lands in two places: the **users** table (income, age, employment, risk, city/state) and a **profiles** record holding four JSON blocks — **assets, liabilities, insurance, tax_data**. Every page reads from these. Users can edit all of it later in **Settings**.

There are three ways to populate data: **manual entry** (onboarding/settings), **Statement scan** (upload a bank statement — parsed on-device), and **bank sync** (coming soon — see Statement/Overview).

---

## 3. The pages

Each page below follows the same structure: **Purpose → What's on it → The information & its use → The figures and how they're calculated.**

---

### 3.1 Overview (Dashboard) — `/dashboard`

**Purpose:** the home screen — your financial life on one page, plus the single most important thing to do next.

**What's on it (top to bottom):**
- **Header** with date and an **"Upload bank statement →"** button (with a note "Auto bank sync coming soon"). This routes to the Statement scan page — the honest way to load real spending today.
- **Ask PayWatch spotlight** — a dark card inviting a question, with three tappable starter questions ("Which tax regime saves me more?", "Is my term cover enough?", "Should I prepay my loan or invest?"). Tapping one deep-links into the chat and auto-asks it.
- **Monthly briefing** card — "your money this month": how much to invest, your top action, your next deadline, and open-alert count.
- **Your N-year opportunity** — the net-worth growth comparison (see figures below).
- **Money Health Score gauge** + the six dimension bars.
- **Net-worth summary** and **top actions** (the three highest-impact items).

**The information & its use:** this screen answers "Am I okay, and what's my next move?" The score tells you where you stand; the briefing and top actions tell you what to do this month; the growth card shows why it's worth doing.

**The figures and how they're calculated:**
- **Money Health Score** — the weighted six-dimension average from §1 (full formulas in §3.4 and §3.8). Shown as a 0–100 gauge with a colour band (red ≤40, amber ≤65, teal ≤85, green >85) and the change since last month.
- **"Your N-year opportunity"** — two numbers side by side:
  - **"If nothing changes"** = your net worth projected forward assuming you keep investing **exactly what you invest today** (your current monthly SIP; if unknown, a modest ~10% of take-home), compounding at your risk-based rate (7/9/11%).
  - **"With PayWatch"** = the same, but assuming you invest the standard target of **~25% of take-home**, stepped up 10% a year, at the same return rate.
  - The **+₹ uplift** is the difference. A **risk toggle (Cautious / Balanced / Aggressive)** sits on the card — changing it re-projects instantly and updates your risk setting everywhere. A disclaimer states these are illustrations, nominal (before ~6% inflation), not guarantees.
  - *Basis:* future-value compounding of a starting corpus plus a monthly contribution; horizons 5/10/20 years. This was deliberately made realistic — the baseline reflects actual behaviour, not an assumption that every spare rupee is already invested.

---

### 3.2 Ask PayWatch — `/ask`

**Purpose:** the flagship. A finance expert in your pocket that actually knows *your* numbers.

**What's on it:** a chat interface. An empty state with suggested questions; a message thread; a text box; past conversations are saved and selectable. A floating "Ask PayWatch" button also appears on every other page so you can ask in context from anywhere.

**The information & its use:** ask anything about your taxes, insurance, debt, savings, goals — and get a plain-English answer **with your actual figures in it**, plus a "Sources" set of chips showing what the answer is grounded in (e.g. "IT Act FY2025-26", "AMFI investor education").

**How it works (the basis):**
- Every question runs through **compliance guardrails** first. If it asks for a specific stock/fund to buy, a crypto call, or "guaranteed returns", the app politely refuses and offers category-level help instead — this is a hard legal boundary (SEBI), not a soft preference.
- It then retrieves the most relevant passages from a **knowledge base of ~47 sourced documents** (tax law, insurance, investing basics, retirement schemes, RBI/SEBI consumer education) **plus the user's own profile and history**, and sends that context to the AI model.
- **The model:** Claude Sonnet 4 (configurable). If no AI key is configured, a deterministic rule-based engine answers from the same profile + knowledge base, so the feature always works.
- Answers are formatted like a real chat (short paragraphs, the odd bullet, key numbers in bold) and never name a specific product.

**Plan note:** Starter plan = a few questions/month; CFO/Family = unlimited, with human-reviewed answers on the paid tier.

---

### 3.3 Alerts — `/alerts`

**Purpose:** a proactive inbox so the app watches your money *for* you between visits.

**What's on it:** a list of alerts tagged **urgent / warning / info / good**, each markable as read or dismissable. The nav shows an unread count badge.

**The information & its use:** alerts are generated by a monitoring engine that watches for things like an approaching tax/advance-tax deadline, a document expiring (from the vault), a spending spike, portfolio drift, a goal falling behind, or a score improvement worth celebrating. The point is recurring value — reasons to come back.

**Basis:** rule-based generators run on demand and on a scheduled job (cron), which can also email/push a digest. Each alert is sent once (deduped).

---

### 3.4 Actions — `/actions`

**Purpose:** a prioritised, quantified to-do list — the "what to do next", with exact rupee amounts.

**What's on it:** a filterable/sortable list of action cards (filter by status/priority, sort by impact). Each card has a **priority badge**, a plain explanation, the rupee impact, and a **"Mark done"** flow that asks "how much / into what", writes the answer back into your profile, and **recalculates your score** on the spot.

**The information & its use:** this is where the score becomes action. Tick one off and watch the gauge move — that feedback loop is the core habit.

**The figures and how they're calculated:** a rule engine (ACT-001 … ACT-021) evaluates the profile and emits the actions that apply, each with a computed **impact score** used to rank them. Examples of the logic:
- **Increase term cover** — fires when you have dependents and term cover below 25× annual income. Shows the recommended cover as a rounded range (e.g. "around ₹10–11 Cr"), not a fake-precise figure.
- **Raise health cover** — fires when health cover is below ₹5L × family size.
- **Build emergency fund** — when liquid savings cover less than 3 months of expenses; shows the rupee gap and a suggested auto-transfer.
- **Pay down credit card** — when utilisation is above 30%; quantifies the interest saved (cards run 36–42%/yr).
- **Use remaining 80C / NPS headroom** — when deduction limits are unused; shows the tax saved at your marginal rate.
- **Switch tax regime** — when the other regime saves meaningfully.
- **Start investing / step up SIP** — for those investing little or nothing.
Each rupee figure is derived from your actual inputs (income, balances, limits) and the relevant standard (25× income, ₹1.5L 80C, 6-month emergency fund, etc.).

---

### 3.5 Net worth — `/networth`

**Purpose:** your complete financial picture — everything you own and owe — and where it's heading.

**What's on it:** an **allocation donut**, an assets/liabilities breakdown, the **growth projection** (with the 5/10/20-year toggle and the risk selector), a **liquidity** read-out, and a spending breakdown.

**The information & its use:** shows not just *how much* you're worth but *how it's composed* (too much idle cash? property-heavy? no gold?) — which feeds the diversification score and the invest plan.

**The figures and how they're calculated:**
- **Net worth = total assets − total liabilities.** Assets are summed across: savings & bank balance, liquid funds, fixed deposits, mutual funds, Indian stocks, US/international stocks, EPF, PPF, NPS, property, gold/SGBs, other. Liabilities: home/personal/car/education loans, credit-card outstanding, informal loans.
- **Allocation buckets:** equity = mutual funds + stocks + US stocks; debt = EPF + PPF + FDs + NPS; real estate = property; gold; cash = savings + liquid funds.
- **Liquidity ratio** = share of assets that are liquid (savings, liquid funds, FDs, MFs, stocks, gold count as liquid; EPF/PPF/NPS/property don't).
- **Growth projection** = the same engine as the dashboard card. Baseline compounds your current SIP; the improved path compounds ~25% of take-home with a 10%/yr step-up; both at your risk-based rate (7/9/11%). Horizons 5/10/20 years. Includes the honest disclaimer and the risk toggle.

---

### 3.6 Invest — `/invest`

**Purpose:** a personalised, SEBI-compliant plan for *where* to put money — categories only, never products.

**What's on it:** your **risk profile** (and why), guardrail warnings (emergency fund / high-cost debt first), a **target-mix donut**, your **current mix**, collapsible **fund-category recommendations** with monthly amounts, **model portfolios**, and concrete start steps.

**The information & its use:** turns "I have spare money" into "here's roughly how to split it, and why" — in plain language a beginner can act on, without ever crossing into regulated advice.

**The figures and how they're calculated:**
- **Risk profile** — if you chose one, it's used. If not, it's derived from a small points model: younger age (+2 under 30, +1 under 40, −1 over 50), fewer dependents (+1 for none, −1 for 3+), and a stable salaried job (+1). ≥3 points = aggressive, ≥1 = moderate, else conservative.
- **Target equity %** = `100 − age`, adjusted **+15 (aggressive) / 0 (moderate) / −15 (conservative)**, clamped to 20–90%. **Gold** = 10/7/5% by risk; **debt** = the remainder.
- **Monthly investable** = about **70% of your free surplus** (take-home − expenses), keeping a buffer; never negative.
- **Guardrails come first:** if your emergency fund is under 3 months, or you carry credit-card debt, the plan tells you to handle those *before* investing — because clearing 36–42% card interest beats any investment return.
- **Recommendations** split the equity bucket into core (large-cap index), growth, international, and ELSS (for tax-saving where relevant), with monthly rupee amounts — always as categories with a "what it is / why for you / liquidity / tax / lock-in" explainer. Hard rule: **no scheme, AMC or stock is ever named.**

---

### 3.7 Markets & news — `/markets`

**Purpose:** stay informed without being told what to buy.

**What's on it:** educational investment **themes** and **live financial news** (pulled from a keyless news feed that fails gracefully if offline).

**The information & its use:** context and financial literacy. Deliberately **no stock tips, no buy/sell calls** — consistent with the compliance lane.

---

### 3.8 Tax — `/tax` *(detailed)*

**Purpose:** show exactly how your tax works and how to legally pay less — in plain English — and run the year-round tax housekeeping a CA would otherwise do.

**What's on it:**
1. **Old vs New regime comparison** — both computed, with the recommended one and the rupee difference.
2. **"How to reduce your tax"** — a collapsible, ordered list of beginner steps, each with the rupee tax it saves.
3. **Tax Copilot** — advance-tax timeline, proof calendar, capital-gains harvesting, and a **CA-ready pack**.
4. **Deduction tracker, tax calendar, document checklist, glossary.**

**The information & its use:** demystifies tax for someone who's never understood it, and quantifies every lever in rupees so the choices are obvious. The Copilot turns tax from a once-a-year panic into a year-round, guided routine.

**The figures — how the tax is actually calculated (FY 2025-26):**

*Step 1 — Deductions.*
- **New regime:** standard deduction **₹75,000**, plus employer-NPS (80CCD(2)) if any. Most other deductions don't apply.
- **Old regime:** standard deduction **₹50,000**, plus your used deductions — **80C** (up to ₹1.5L), **80CCD(1B)** NPS (up to ₹50k), **80D** health (self + parents), **24(b)** home-loan interest (up to ₹2L), **80G** donations, **80E** education-loan interest, **HRA exemption**, and professional tax (≈₹2,400).
- **HRA exemption** = the minimum of: (a) HRA received, (b) rent paid − 10% of basic salary, (c) 50% of basic (metro) or 40% (non-metro).

*Step 2 — Taxable income* = gross income − deductions.

*Step 3 — Slab tax.* Applied marginally (each band taxes only the income within it):

| New regime (FY25-26) | Rate | | Old regime | Rate |
|---|---|---|---|---|
| up to ₹4L | 0% | | up to ₹2.5L | 0% |
| ₹4–8L | 5% | | ₹2.5–5L | 5% |
| ₹8–12L | 10% | | ₹5–10L | 20% |
| ₹12–16L | 15% | | above ₹10L | 30% |
| ₹16–20L | 20% | | | |
| ₹20–24L | 25% | | | |
| above ₹24L | 30% | | | |

*Step 4 — 87A rebate.* If taxable income is at or below **₹12L (new)** or **₹5L (old)**, the slab tax is **wiped to zero**. This is why most people earning up to ~₹12.75L gross pay no income tax under the new regime (₹12L + ₹75k standard deduction).

*Step 5 — Surcharge* (on high incomes): 10% above ₹50L, 15% above ₹1Cr, 25% above ₹2Cr, and 37% above ₹5Cr (capped at 25% in the new regime).

*Step 6 — Cess:* 4% health & education cess on (tax + surcharge).

**The recommendation** simply computes both regimes end-to-end and picks the lower tax, showing the exact rupee saving and the reason.

**Marginal rate** (used to value each deduction) = your top slab rate × 1.04 (cess). The reduction plan multiplies each unused-deduction rupee by this to show "this saves you ₹X".

**Tax Copilot specifics:**
- **Advance tax** applies when you have **non-salary income** and estimated tax **above ₹10,000**; it schedules four instalments — **15 Jun (15%), 15 Sep (45%), 15 Dec (75%), 15 Mar (100%)** — each marked paid/due-soon/upcoming based on today's date, to avoid 234B/234C interest. Salaried-only users are told advance tax usually doesn't apply (TDS handles it).
- **Capital-gains harvesting:** equity long-term gains up to **₹1.25L/year are tax-free**; the Copilot explains selling-and-rebuying before 31 March to "use up" that free limit legally.
- **CA-ready pack:** assembles your regime, gross/taxable income, estimated tax, effective rate, the itemised deductions and the document list — to hand to a CA or use yourself.

---

### 3.9 File your ITR — `/file` *(detailed)*

**Purpose:** the heart of "do a CA's individual-return work in software" — a guided wizard that computes the **entire** return and either walks you through filing it yourself or hands your CA a ready-to-file pack.

**What's on it:** a four-step wizard — **Income → Deductions → Tax paid → Result** — with helpers: upload a **Form 16 PDF** to auto-fill salary/TDS, and upload a **broker capital-gains CSV** to auto-fill STCG/LTCG. The Result screen shows the computation, the refund or amount payable, the chosen ITR form, a "**Prefer to use a CA?**" pack download, a "how to file it yourself" portal walkthrough, and a documents checklist.

**The information & its use:** for most salaried/individual taxpayers this replaces the need to pay someone to compute the return. It's built so a non-expert can follow it end to end.

**The figures — how the full return is computed:**

*Income heads gathered:* gross salary, interest income (savings + FD), house-property income (net; a **loss is capped at ₹2L**), other income (dividends/misc), business/professional income, and capital gains split into **STCG on listed equity**, **LTCG on listed equity**, and **other capital gains** (taxed at slab).

*Both regimes are computed in full:*
1. **Salary after standard deduction** (₹75k new / ₹50k old).
2. **Gross total income** = salary-after-std + interest + house property + other + business + other CG + equity STCG + equity LTCG.
3. **Deductions:** employer NPS in both regimes; in the **old** regime also 80C, 80CCD(1B), 80D, 24(b), 80G, 80TTA, 80E and HRA.
4. **Normal-rate slab tax** on (normal income − deductions), with the **87A rebate** applied (zeroes tax up to ₹12L new / ₹5L old) — but the rebate applies only to normal-rate tax, **not** to capital gains.
5. **Capital-gains tax at special rates:** equity **STCG at 20%** (sec 111A), equity **LTCG at 12.5%** on gains **above the ₹1.25L exemption** (sec 112A).
6. **Surcharge** (same high-income bands as Tax) and **4% cess** on top.
7. **Total tax** = slab tax + capital-gains tax + surcharge + cess.

*Reconciliation:* **taxes already paid** = TDS on salary + TDS on other income + advance tax. **Refund (if positive) or amount payable (if negative)** = taxes paid − total tax. The wizard recommends whichever regime gives the lower total tax.

*Form selection (which ITR you file):*
- **ITR-1 (Sahaj):** resident, salary + one house property + interest, total income under ₹50L — the simplest.
- **ITR-2:** capital gains, or income over ₹50L, or more than one house property, or foreign assets, or you're a company director.
- **ITR-3:** income from a business/profession (non-presumptive).
- **ITR-4 (Sugam):** presumptive business/professional income (44AD/44ADA) under ₹50L.

*The CA boundary (be precise when presenting):* the engine **flags the rare cases that legally still need a CA** — e.g. a likely tax audit (u/s 44AB) on large non-presumptive business income. For those it still prepares everything and the CA only counter-signs. One-click *submission* to the tax department needs **ERI registration** (a future step); until then the wizard gives the exact portal walkthrough so the user self-files in minutes, cross-checking against Form 26AS/AIS.

---

### 3.10 Insurance — `/insurance`

**Purpose:** find the gaps in your protection and explain plainly what to get — and what to avoid.

**What's on it:** coverage **rings** for term and health (current vs target), collapsible **"what to get"** recommendations with premium estimates, and a **"what to avoid"** list.

**The information & its use:** insurance is where beginners are most exposed (or most over-sold). This shows whether you're under-covered and steers you to pure, cost-effective cover.

**The figures and how they're calculated:**
- **Term life target = 25× annual income**, shown as a rounded range; needed only if you have dependents (no dependents → not a priority; students → excluded).
- **Health target = max(₹10L, ₹5L × family size)**, scaled up past age 40.
- **Insurance score** = 60% term + 40% health; **zero term with dependents caps the dimension at 30** (it's the single biggest gap).
- **Premium estimates** are rough heuristics (term ≈ ₹900–1,300 per ₹1L of cover/yr for a healthy 30-year-old, scaled by age).
- **"What to avoid"** flags endowment/money-back/ULIP products (they mix insurance with poor ~4–6% returns) and "buying just to save tax in March".

---

### 3.11 Statement scan — `/statement`

**Purpose:** turn a real bank statement into a detailed spending report — the genuine way to analyse spending today (while live bank sync is pending).

**What's on it:** a file upload (CSV / Excel / PDF) and a generated report: category breakdown, total invested, recurring subscriptions, suggestions to cut, and watch-outs.

**The information & its use:** reveals where money actually goes, feeds the savings-rate and emergency-fund dimensions, and surfaces leaks (unused subscriptions, high discretionary spend).

**Basis & privacy (important selling point):** the file is **parsed entirely on your device** in the browser — it is **never uploaded** to a server. Transactions are auto-categorised by description-matching rules (salary, investments, food, transport, utilities, EMIs, etc.).

---

### 3.12 Document vault — `/vault`

**Purpose:** track the paperwork a CA would ask for, with expiry reminders.

**What's on it:** slots for key documents, a "X/Y ready" readout, and expiry tracking that feeds the Alerts inbox before anything lapses.

**The information & its use:** keeps tax and insurance documents organised year-round so filing season isn't a scramble — part of the "make your CA's job faster" positioning.

---

### 3.13 Goals — `/goals`

**Purpose:** set financial goals (house, education, retirement) and track progress.

**What's on it:** goal cards with target amount, timeline and a monthly contribution needed, projected forward at expected returns.

**Basis:** goal projections use the same compounding maths as the net-worth growth engine (a starting amount plus monthly contributions at an assumed return), with inflation noted for long-horizon goals like education and retirement.

---

### 3.14 Reports — `/reports`

**Purpose:** generate shareable documents and summaries from your data — net-worth statement, tax computation packs, 80G/rent receipts, etc.

**The information & its use:** the "CA document generator" surface — printable outputs you can keep or hand to a professional. Statements clearly note they're compiled from self-declared figures and aren't CA-certified/audited.

---

### 3.15 Plans — `/plans`

**Purpose:** subscription tiers and upgrade.

**What's on it:** three plans — **Starter (₹299)**, **CFO (₹699, most popular)**, **Family (₹1,199)** — with feature lists, a soft paywall ("upgrade" banners on premium features), and a **"Welcome to PayWatch Plus"** modal after subscribing. Paid users get a **"Plus" badge** on the logo and the upgrade prompts disappear.

**The information & its use:** the value ladder. Starter = get organised (score + a few actions/questions). CFO/Family = the recurring value (unlimited Ask PayWatch, full tax engine, complete insurance analysis, proactive alerts, document vault, advisor call). Positioning: "a private CFO in your pocket — plus everything your CA needs, ready to hand over."

---

### 3.16 Settings — `/settings`

**Purpose:** manage your profile and data.

**What's on it:** a **Personal details** tab (name, mobile, email, age, employment, dependents, risk, state/city), a **Financial data** tab (income, assets, liabilities, insurance, tax data — the inputs that drive every calculation), and a **Subscription** tab. Plus data export and account deletion (DPDP rights).

**The information & its use:** the single source of truth for everything the engines compute. Changing risk here (or on the growth card) updates projections and the invest plan everywhere.

---

## 4. The numbers cheat-sheet (for Q&A)

| Thing | Value / rule | Where used |
|---|---|---|
| Score weights | Savings 25 · Insurance 20 · Diversification 20 · Emergency 15 · Debt 10 · Tax 10 | Score |
| Savings-rate target | 25%+ of take-home | Savings dimension, growth "plan" |
| Emergency fund target | 6 months (3 min) of expenses | Emergency dimension, invest guardrail |
| Term life target | 25× annual income (if dependents) | Insurance, Actions |
| Health cover target | max(₹10L, ₹5L × family size) | Insurance |
| EMI safe ceiling | < 40% of take-home | Debt dimension |
| Credit-card utilisation | < 30% healthy | Debt dimension, Actions |
| New regime std deduction | ₹75,000 | Tax, ITR |
| Old regime std deduction | ₹50,000 | Tax, ITR |
| 87A rebate (zero tax up to) | ₹12L taxable (new) / ₹5L (old) | Tax, ITR |
| Cess | 4% | Tax, ITR |
| Surcharge bands | 10/15/25/37% above ₹50L/1Cr/2Cr/5Cr | Tax, ITR |
| Equity STCG | 20% (sec 111A) | ITR |
| Equity LTCG | 12.5% over ₹1.25L/yr exempt (sec 112A) | ITR, harvesting |
| House-property loss cap | ₹2L | ITR |
| 80C limit | ₹1.5L | Tax, Actions |
| 80CCD(1B) NPS | ₹50,000 extra | Tax, Actions |
| Target equity % | 100 − age ± 15 (risk), clamped 20–90 | Invest |
| Gold allocation | 10/7/5% (cautious/balanced/aggressive) | Invest |
| Monthly investable | ~70% of (take-home − expenses) | Invest |
| Projection returns (nominal) | 7% / 9% / 11% by risk | Net-worth growth, Goals |
| Growth step-up | +10%/year on the improved path | Net-worth growth |
| AI model | Claude Sonnet 4 (rule-based fallback) | Ask PayWatch |

---

## 5. Honesty notes (so you're never caught out)

- **Returns are assumptions, not guarantees.** Every projection says so, is nominal (before ~6% inflation), and is deliberately conservative.
- **No specific securities, ever.** Category-level only — this is a legal line (SEBI), and it's also why people can trust the guidance isn't a sales pitch.
- **Tax features prepare and compute; they don't replace a CA where the law requires one** (audits, certifications). One-click e-filing needs ERI registration (a planned step); today the app gives an exact self-file walkthrough.
- **Bank sync is "coming soon."** Today, spending comes from the on-device Statement scan (the file never leaves the device).
- **The app works alongside CAs and advisors** — it makes their job faster (CA-ready packs) and gives individuals everyday clarity; it doesn't claim to replace accountable professional advice.

---

*Prepared as a presenter's reference. Figures reflect FY 2025-26 tax law and the app's current engines. Always verify tax rules against the official source before relying on them.*
