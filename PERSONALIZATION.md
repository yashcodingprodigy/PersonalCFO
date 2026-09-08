# PayWatch — Hyper-Personalization Architecture

> How PayWatch becomes a true *personal financial officer* — tailoring guidance to each user's life
> stage, goals, occupation, employer benefits and government schemes — while keeping the experience
> simple. Companion to `WORKFLOW.md` / `DECISIONS.md`. Last updated: Aug 2026 (initial spec).

---

## 0. The core principle

**Personalization must REDUCE what the user sees, not add to it.** The engines do the complex
reasoning; the user gets *fewer, sharper, more relevant* things. A 55-year-old settling down should
not see 20 options — he should see "given your booster covers you to ₹40L and you're near retirement,
your top 3 are: shift new money to preservation, set up a steady-income plan, keep the booster intact."
Hyper-personalization *feels like simplicity* because it strips away everything irrelevant to *this* person.

---

## 1. The five-layer personalization stack

| Layer | What it captures | Source | Status |
|---|---|---|---|
| 1 · Quantitative base | age, income, dependents, debt, credit, spend | onboarding + uploads | ✅ built |
| 2 · Life stage | accumulation → consolidation → pre-retirement → retirement | age + goals + intent | ⛔ to build |
| 3 · Goals & intent | what the user actually wants (grow / settle / protect) | onboarding + Ask PayWatch | ◑ partial |
| 4 · Occupational & scheme context | employer benefits, govt schemes, profession perks | AI capture + schemes KB | ⛔ to build (the moat) |
| 5 · Behavioural / spend | real lifestyle, commitments, recurring | statement analysis | ✅ built |

**Layers 1 & 5 are table-stakes** (any dataset has them). **Layer 4 is the differentiator and the moat** —
no dataset contains it; PayWatch must capture it per-user. (We confirmed this on the Kaggle set: it has
age/income/debt/credit/spend but *nothing* occupational, benefit- or scheme-related.)

---

## 2. Layer 2 — the Life-Stage model (build first, biggest unlock)

Derive a **life phase** from age + dependents + stated intent, then reframe *every* engine's output for it.

| Phase | Typical age | Financial job | How guidance reframes |
|---|---|---|---|
| **Accumulation** | ~19–35 | build habits, grow | maximise SIP/equity, emergency fund, first insurance |
| **Consolidation** | ~35–50 | grow + protect family | cover gaps, tax efficiency, goal funding (home/kids) |
| **Pre-retirement** | ~50–60 | protect + plan income | shift growth→preservation, retirement corpus, estate |
| **Retirement** | ~60+ | income + preservation | decumulation, steady income, healthcare, estate/nominee |

Rules:
- Phase is derived, but the user can override (some 55-year-olds are still aggressive; respect stated intent).
- Each engine takes `lifePhase` as an input and changes its recommendation, **not just its wording**:
  - `investment.ts` — equity target *falls* with phase (already age-linked; make it phase-linked + intent-aware).
  - `insurance.ts` — pre-retirement/retirement de-emphasise term life (no dependents / self-covered), emphasise health.
  - `networth.ts` growth projection — retirement = decumulation/withdrawal model, not accumulation.
  - `score.ts` — reweight dimensions by phase (e.g. emergency + insurance matter more near retirement; tax stays).
  - `actions.ts` — surface phase-appropriate actions (retirement → "set up SCSS / income plan", not "start your first SIP").
- Add `lifePhase` + `lifeIntent` to `ProfileData` (derived in `profile.ts`, overridable from Settings/onboarding).

---

## 3. Layer 4 — the Context & Benefits store (the moat)

The hard, differentiating layer. You cannot hardcode every employer perk and scheme, so the model is:
**structured store + AI capture + a curated schemes knowledge base.**

### 3.1 The data schema (new `context` block on `profiles`)

```jsonc
context: {
  occupation: "university_faculty",     // controlled vocab + free text
  employer: "MAHE",
  sector: "education",
  employment_nature: "salaried",        // salaried | self_employed | business | retired | student
  // The long tail: benefit/scheme facts the engines respect
  benefits: [
    {
      id: "mahe_ins_booster",
      type: "insurance_booster",        // insurance_booster | group_health | group_term | epf | nps |
                                        // gratuity | gpf | esops | pension | govt_scheme | perk | other
      label: "MAHE faculty insurance booster",
      source: "employer",               // employer | government | professional_body | bank | other
      value_base: 500000,               // ₹5L in paise-normalised as elsewhere
      value_boosted_to: 4000000,        // boosts up to ₹40L
      rule: "redeemable; user split 2.5L/2.5L, preserving booster for emergency",
      status: "active",
      affects: ["insurance.health", "insurance.term", "score.insurance"],
      confidence: "user_stated",        // user_stated | doc_verified | inferred
      captured_at: "2026-08-…",
      source_note: "captured from user conversation"
    }
  ]
}
```

Every benefit fact carries **what it affects** (`affects[]`) so engines know to read it, and a
**confidence** tag (user-stated vs document-verified vs inferred) so we never over-trust.

### 3.2 How each engine consumes context facts

- **insurance.ts** — before computing a term/health gap, subtract cover the user *already effectively has*
  from benefits (group cover, the ₹40L booster). Result for the MAHE faculty: *stop nagging him to buy
  term he doesn't need; credit the booster; advise keeping it intact as emergency cover* — exactly his plan.
- **taxFiling.ts / tax.ts** — fold employer/scheme facts into deductions: EPF/VPF, NPS (80CCD), GPF (govt),
  scheme investments (SSY, SCSS), professional-body perks.
- **investment.ts** — count EPF/NPS/gratuity/GPF as existing debt allocation; don't double-suggest them.
- **networth.ts** — include pension/gratuity/scheme corpus in retirement projection.
- **score.ts** — a verified group-cover/booster fact lifts the insurance dimension; scheme participation lifts relevant dims.
- **actions.ts / alerts.ts** — surface benefit-specific actions ("your booster renews in 30 days", "you're eligible for SCSS").

### 3.3 The AI capture flow (how the long tail gets in — simply)

This is the elegant part: **the user just tells PayWatch once, in plain language, and it's remembered and applied everywhere.**

1. **Detect** — `cfo-ai.ts` (Ask PayWatch) and onboarding notice a life-stage/context gap and **ask the right question**:
   *"You're 55 and thinking about settling down — do you have employer pension/NPS/gratuity? Any special insurance from work?"*
2. **Extract** — when the user answers (chat) or uploads a document (`docAI.ts`), the AI extracts a **structured benefit fact** in the schema above (label, type, values, rule).
3. **Confirm** — user confirms the parsed fact (never trusted blindly — same pattern as records/insurance uploads).
4. **Store** — saved to `profiles.context.benefits[]` with a `confidence` tag.
5. **Apply** — the fact now flows into every engine via `affects[]`, and into Ask PayWatch's grounding context, so
   "am I insured enough?" is answered from the real ₹40L booster.
6. **Maintain** — facts carry status/expiry so alerts can nudge ("booster renewal due").

### 3.4 The Schemes & Benefits Knowledge Base (proactive personalization + data moat)

A curated, growing RAG library so PayWatch can *proactively* surface relevant opportunities the user
didn't mention. Entries map an opportunity to **eligibility signals** (age / gender / income / occupation /
sector / employment_nature / state):

```jsonc
{ key: "scss", name: "Senior Citizen Savings Scheme", type: "govt_scheme",
  eligible_if: { min_age: 60 }, benefit: "guaranteed quarterly income, 80C",
  affects: ["invest","tax","retirement"], source_tag: "Govt of India" }
{ key: "ssy",  name: "Sukanya Samriddhi Yojana", type: "govt_scheme",
  eligible_if: { has_girl_child_under_10: true }, benefit: "tax-free, high rate, 80C" }
{ key: "nps_employer", name: "Employer NPS (80CCD(2))", type: "employer_benefit",
  eligible_if: { employment_nature: "salaried" }, benefit: "extra deduction beyond 80C" }
```

**Seeding priority** (high-value, finite, universal first): core government schemes by age/gender/income
(SCSS, SSY, PPF, NPS, PMVVY, APY, Ayushman), then common **employer/sector benefits** (EPF/VPF, gratuity,
group health/term, GPF for govt, ESOPs for startups), then **profession perks** (faculty boosters, KCC/PM-Kisan
for farmers, indemnity for doctors), then **state schemes**. This KB compounds over time into a real moat.

---

## 4. Layer 1/5 — the base layer + peer benchmarking (from data)

The quantitative base is buyable/derivable and should power **peer benchmarking** ("people like you…"),
which makes even generic guidance feel personal. From the Kaggle set (4,941 unique Indian profiles) we
derived five data personas and an income-tier × life-stage benchmark grid:

**Five data-derived personas** (medians): High-earner-leveraged (₹12L income, ₹4.5L debt), Affluent-spender
(₹8L income, high spend, low debt), Young-starter (~29, ₹4.7L), Debt-free-saver (~46, ₹0 debt, 786 credit),
Constrained-pre-retiree (~58, low income, 659 credit).

**Peer-benchmark grid** (median debt by income tier × life stage) — the shape PayWatch uses for "people your
age and income typically…" comparisons. *(Full numbers in the analysis output / the segmentation artifact.)*

**Honest caveat:** this particular dataset is fairly **synthetic and uniform across life stages** (income/credit/spend
barely move by age), so it demonstrates the *method* (how to segment + benchmark real users) but is **not a
source of real behavioural truth**. That reinforces the whole thesis: real personalization — the contextual
layer — has to come from the user, not a bought dataset.

---

## 5. Progressive profiling (keeping it simple)

Don't ask 50 questions upfront. Enrich the profile over time:
- **Onboarding (light):** age, income, dependents, employment nature, **occupation/employer**, and one intent question
  ("what's your money focus right now — grow, settle, protect?") → sets life phase + seeds context.
- **Uploads:** statements, policies, payslips already feed the profile; `docAI` also extracts benefit facts.
- **AI enrichment:** Ask PayWatch asks one smart question at a time when it detects a gap, and stores the answer.
- The profile gets richer with use — the **data flywheel** and switching-cost moat (see DECISIONS D-23/D-26).

---

## 6. Implementation staging

1. **Life-stage model** (`profile.ts` derives `lifePhase`/`lifeIntent`; each engine consumes it). Biggest unlock, self-contained.
2. **Context & benefits store** (schema on `profiles`; `affects[]` wiring into insurance/tax/invest/score/networth).
3. **AI capture** (extend `cfo-ai.ts` to detect gaps + ask; `docAI.ts` to extract benefit facts; confirm-before-save).
4. **Schemes/benefits KB** (seed government schemes first; RAG-match on eligibility signals; proactive surfacing).
5. **Peer benchmarking** (base-layer segments → "people like you…" comparisons on dashboard/score).

Each stage is shippable on its own and additive — no big-bang rewrite. Life-stage first.
