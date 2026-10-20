# PayWatch — STRATEGY (vision → canvases → journeys → economics → action plan)

> The one place that connects *why* (vision, research, canvases) to *what we do next* (product + weekly plan).
> Read with `CLAUDE.md` (project context), `WORKFLOW.md` (how the code runs) and `DECISIONS.md` (why we chose).
> Last updated: 20 Oct 2026.

---

## 1. Vision in one line
**One money brain that turns every dream into a plan.** PayWatch quietly handles tax, insurance and investing in the
background so a young earner can focus on the life they want. Money is the enabler, not the goal.

- **Who first:** “Daisy” — 22–30 first earners, small-town & metro India, phone-first, no advisor. Dreams big, worries
  quietly. Secondary: students with first income, salaried + side-business, people supporting parents. Underserved
  frontier: live-in & queer couples, freelancers/digital nomads (cross-border).
- **The promise in the moment that matters:** she wants something → instead of guilt or confusion she hears
  *“Yes — here’s how.”*
- **The 50-year view:** no one should give up a dream because they didn’t know how to afford it.

## 2. What we already know (don’t re-research this)
| Source | What it told us |
|---|---|
| Task 1 — empathy maps (20 conversations, 49 surveys) | Confidence ~6/10; 45% stressed about money often/daily; only 29% have a 3-month emergency fund; 78% want a “financial health” app; trust is fragmented (parents, finfluencers, nobody). |
| Task 3 — 56 interviews (WTP) | ₹999/yr was the most-picked price (41%); only ~10% would pay with no trial; ~40% would after a free trial; trust, not price, is the blocker (“proof before payment”). |
| Task 4 — verification + sizing + tester list | Consent form re-verifies interviews; bottom-up TAM/SAM/SOM; a consented tester cohort to onboard. |
| Competitor work | FOLO = net-worth tracker (+family sharing); Jumpp = AI super-app (bank/trade/pay, Hindi voice); INDmoney = investing-first; ClearTax = seasonal tax; CA = trusted but costly & seasonal. Nobody does dreams-first + next step + whole life. |
| Market anchor | 7+ crore ITRs filed AY 2025-26 (TAM proxy for people with a taxable money life). |
| Mentors | Upendra: be bold, deep personas from real people, delight, headless/everywhere, trust journey per stakeholder. Ellen: VPC/BMC/Blue Ocean discipline; quantify segments. |
| Legal | SEBI: education lane (personalised allocation may = “financial planning” → RIA partner question for counsel). IRDAI: sell via licensed partner. ICAI: CA tool is private, never a marketplace. DPDP: we are a Data Fiduciary. |

**Still unknown (Task 5 + founder interviews answer these):** Daisy’s real day, small delight moments, family duties,
which money questions she’s embarrassed to ask, and exactly what she would/wouldn’t share with an app.

## 3. The canvases, connected
- **Value Proposition Canvas** (`PayWatch-Value-Proposition-Canvas.png`) — strongest fit: *“Am I on track?”* (score),
  *guilt when spending* (dreams + joy budget), *jargon & fear of mistakes* (plain answers from her own numbers),
  *sharing data feels risky* (trust ladder). Honest gap: execution needs licences/partners.
- **Blue Ocean** (`PayWatch-Blue-Ocean-Canvas.png`) — **Eliminate** trading/F&O, stock tips, jargon dashboards ·
  **Reduce** manual tracking, price of advice · **Raise** next-step guidance, plain language, trust · **Create**
  dreams-first planning, delight moments, a brain that lives everywhere, works with your own CA.
- **Business Model Canvas** (`PayWatch-Business-Model-Canvas.png`) — revenue: freemium subscription (test ₹999/yr +
  trial), insurance distribution via licensed partner, later MF trail & employer plans; never CA commissions or data sales.

**The product now embodies the canvases:** the **Money Brain** (`server/src/services/brain/`) *is* the value
proposition — money map → dreams plan → life events → ranked next moves → “can I afford it?” — and every screen reads
from it (one truth, see DECISIONS D-37).

## 4. Daisy’s journey — and what the brain automates at each step
| Stage | Daisy’s moment & feeling | Channel / touchpoint | What the brain does (✅ built · ⏭ next) | BMC link | KPI |
|---|---|---|---|---|---|
| **1. Discover** | “Everyone else seems sorted. Am I behind?” (anxious) | Word of mouth, campus, Instagram content, a friend’s referral; ⏭ employer benefit | ⏭ Shareable “Can I afford it?” result cards; ⏭ referral loop | Channels · cost: content/referral | Visits → signups |
| **2. First 5 minutes** | “Will this judge me? Is it safe?” (wary) | Web/app; demo login for the curious | ✅ Email login, demo account · ⏭ onboarding opens with *“What do you want this year?”* (dream first, no bank data) | Relationship: trust ladder step 1 | % who add ≥1 dream in session 1 |
| **3. Aha** | “Oh — I *can* do Goa in April.” (relief, delight) | Dreams page | ✅ `planDreams` plan + done-by date + levers; ✅ `affordCheck` verdicts; ✅ joy budget | Value prop core | Time-to-first-“yes” |
| **4. Trust deepens** | “If it helps, I’ll show it my numbers.” | Statement upload / payslip / policies | ✅ Statement scan, AI document reader, encrypted vault · ⏭ AA live bank data (FIU) | Key resource: consented data | % who share data (ladder step 2–3) |
| **5. Monthly habit** | “What should I do this month?” (in control) | Dashboard Next Moves, alerts, ⏭ monthly email/push briefing | ✅ `buildNextMoves` ranked feed; ✅ alerts aligned to the plan · ⏭ salary-day nudge | Relationship: long-term, automated | W4 retention, moves done/month |
| **6. Life happens** | Raise, bonus, new EMI, big spend (surprise) | Same feed | ✅ `detectLifeEvents` → re-plan suggestion · ⏭ auto re-plan + push | Retention driver | Event → action rate |
| **7. Protect what matters** | “What if Mom falls sick?” (fear) | Insurance check → in-app compare/buy | ✅ gap analysis + marketplace + application flow · ⏭ live quotes & issuance via licensed partner | **Revenue: insurance commission (via partner)** | Gap → application rate |
| **8. Tax season** | “Am I overpaying? Which ITR?” (dread) | Tax page, CA share | ✅ full computation, regime compare, self-file guide, CA-ready pack · ⏭ ERI one-click e-file | Retention + upgrade moment | Filings prepared; upgrade rate |
| **9. Dream achieved** | “I actually did it.” (joy, pride) | Dreams page | ✅ status → achieved; cascade moves money to next dream · ⏭ celebration + share card | Referral moment | Dreams completed; referrals |
| **10. Grow together** | Partner / parents / own CA in the loop | CA portal; ⏭ shared dreams for couples/family | ✅ private user↔own-CA sharing · ⏭ “us” dreams (live-in & queer couples) | User-to-user relationships | Shared dreams; CA links |

**User-to-user relationships we design for:** user ↔ own CA (private, never a marketplace) · couple/family ↔ shared
dreams & nominees (next) · user ↔ friend (referral, shareable “yes” cards) · crowd ↔ benefits catalogue (aggregate-only,
≥3 users, DPDP-safe).

## 5. Lifecycle economics per user (what each step costs and earns)
Detailed model: `PayWatch-Unit-Economics-Model.xlsx` / `PayWatch-Investor-Model.xlsx`. The logic:

- **Acquire (CAC):** cheapest → most expensive: referral & campus (≈₹0–50) · content/community · employer/college B2B2C
  (one deal = many users) · paid ads (only after retention is proven).
- **Serve (cost to serve/month):** hosting + storage (fixed, small) + AI usage. **Optimisation built in:** the brain is
  deterministic (no AI cost) — Claude is used only to phrase answers and read documents, with rule-based fallbacks; cache
  the brain per user per day (⏭).
- **Earn:** subscription after a free trial (research: ~10% pay day-1, ~40% after trial) · insurance commission when a
  protection gap becomes a policy via the licensed partner · later MF trail (after ARN) · employer plans.
- **Keep (LTV):** retention comes from the monthly loop (next moves, life events, tax season, dreams completing).
  Annual plan (₹999/yr) reduces monthly churn psychology.
- **The rule:** don’t spend on acquisition until W4 retention and trial→paid conversion are measured on real users.

## 6. Impact — and how we keep the negatives small
| Negative | Mitigation (built ✅ / next ⏭) |
|---|---|
| Over-reliance on AI; a wrong answer could hurt | ✅ Deterministic brain for every number; AI must lead with the computed verdict; disclaimers; CA hand-off · ⏭ expert sanity checks of engines (expert call) |
| Privacy risk | ✅ Encryption at rest, RLS lockdown, consent ledger, delete anytime, never sell data, trust ladder · ⏭ DPDP notice, grievance officer, breach plan |
| “Joy budget” could nudge spending | ✅ Joy only comes from free cash *after* safety net; levers never suggest debt |
| Exclusion (no smartphone / English-only) | ⏭ Hindi & regional language, voice, WhatsApp door |
| AI/compute energy | ✅ Deterministic-first; ⏭ caching, efficient model use |
| Positives to amplify | Financial confidence, parents protected (less medical debt), real tax savings, paperless filing, CAs serve clients faster |

## 7. Execution plan — 6 weeks, product first (research time-boxed to ~20%)
| Week | Product (Yash + Claude) | Research (Vighnesh / Yash) | Done when |
|---|---|---|---|
| **1 · 19–25 Oct** | Ship Phase 0 + Money Brain: push; Resend domain + env; RLS live; `cap:sync` | Task 5 Part A (re-mine); Yash 2 interviews (guide: `PayWatch-Founder-Interview-Guide.docx`) | Brain live on paywatch.in; demo shows Next Moves + Dreams |
| **2 · 26 Oct–1 Nov** | Dreams-first onboarding (“What do you want this year?” before any numbers); monthly briefing email from the brain; per-user daily brain cache | Task 5 Part B (8 deep chats); Yash 2 more | New user reaches first “yes” in < 3 min |
| **3 · 2–8 Nov** | Product analytics (activation, moves done, retention); feedback form; onboard first 20–30 testers from Task 4 cohort | Task 5 Part C → combined Daisy; Daisy v2 to Upendra | 20+ real users with data |
| **4 · 9–15 Nov** | Chat door prototype (Telegram/WhatsApp test number) on the same brain; shareable “yes” card | Stakeholder trust maps (insurer partner, CA, investor) | Mentor demo of “money brain everywhere” |
| **5 · 16–22 Nov** | Fix what testers hit; Hindi copy for core flows; insurance partner outreach (quote/issue API) | Insurance partner shortlist | Top-3 tester issues fixed |
| **6 · 23–29 Nov** | Pricing test: ₹999/yr + trial vs monthly; accelerator metrics pack | — | One metric reported weekly: **% of users who act on a next move in week 1** |

**Parallel (needs professionals):** incorporate (Pvt Ltd) → unlocks DLT SMS, Razorpay live, partner contracts,
trademark; ask counsel the SEBI “financial planning” question (RIA partner vs registration); AMFI ARN later.

## 8. Working smart — operating rules
1. **One metric that matters** (until 100 users): % of new users who act on a next move in week 1.
2. **Ship weekly**, demo to a mentor every 2 weeks. A feature isn’t done until it’s tested and on the brain.
3. **Research is time-boxed** (~20%) and must change the product within a week, or it was trivia.
4. **One truth:** every number comes from the brain; if two screens disagree, it’s a P0 bug (`brain.test.ts` “engines agree”).
5. **Seams, not blockers:** anything needing a licence/API ships as a mock behind a seam (`GET /v1/brain/readiness`).
6. **Log decisions** in `DECISIONS.md` the day they’re made.
