# PayWatch — DECISIONS (why we chose what we chose)

> A running ledger of the meaningful decisions behind PayWatch — product, technical, compliance
> and business — each with the reasoning and the main alternative we rejected. Read this before
> re-litigating a settled choice. **Append new decisions as they're made; don't delete history —
> if a decision is reversed, add a new dated entry noting what changed and why.**
> Format: **D-##  Decision** — Why · *Rejected: alternative (reason)*. Last updated: Oct 2026.

---

## A. Positioning & product

**D-01  "Personal-finance operating system," not another tracker.** One app across income, spending,
savings, investments, loans, insurance, tax — that tells you *what to do next*. Why: PFM apps die from
*tracking, not acting*; the guidance/action layer + a moving score is the antidote and the differentiator.
*Rejected: pure expense tracker / single-vertical app (commoditised, low retention).*

**D-02  "Ask your CFO" → renamed "Ask PayWatch" as the hero.** A private CFO in your pocket, grounded in
the user's own numbers, in beginner language. Why: it's the emotional hook and the thing no silo competitor
offers; surfaced in nav + dashboard + landing. *Rejected: burying AI as a sub-feature.*

**D-03  Works ALONGSIDE the user's CA — never "replace your CA."** Framing: helps your CA now (CA-ready
packs, computed returns), may reduce the need over time. Why: audits/certifications legally need a CA (§ compliance),
and antagonising CAs kills a distribution channel. *Rejected: "no CA needed" (false + legally risky + hostile).*

**D-04  Serve students (~19–23) AND working professionals.** `employment_type` includes `student` and `both`
(salaried + business). Why: capture users at first-earner stage, build lifetime habit; students are underserved.
Score/insurance/tax all adapt (no life-cover pressure with no dependents, no tax pressure below threshold).

**D-05  Value ladder: one-time hook → recurring subscription.** Free Money Health Score + "what to invest in"
as the hook; recurring value = alerts, briefing, tax copilot, watchdog, autopilot, vault. Why: the recurring
engine is what justifies a subscription and drives retention. *Rejected: one-off report (no recurring revenue).*

**D-06  Money Health Score is the dashboard hero, animates 0→score on every visit.** Why: one understandable
number turns a diffuse financial picture into something a beginner can act on and feel progress against.

**D-07  Tagline "Watch your money grow."** Why: ties to the brand name, positive/aspirational, compliant
(growth of *their* money, not a return promise).

---

## B. Compliance lanes (the ones we must never drift out of)

**D-08  SEBI: education/organisation only — never name a security.** Only asset-class / fund-**category**
guidance; no <3-month price data beside a named security (finfluencer rule). Why: naming products or giving
paid specific advice triggers SEBI RIA registration and finfluencer rules. *Rejected: naming funds/stocks now.*

**D-09  Tax: "prepare, compute & guide self-filing," not "we file for you."** Why: preparation/computation
needs no licence (removes the CA for most salaried individuals); one-click e-filing needs **ERI** registration;
audits/15CB need a CA. Engine flags the audit case. *Rejected: claiming full e-filing before ERI.*

**D-10  Investing near-term path = AMFI Mutual Fund Distributor (ARN).** NISM V-A + ARN (~₹3–5k, low barrier)
→ route MF/SIP via BSE StAR MF (Cybrilla/FintechPrimitives). MFD = distribution (trail commission), NOT advice.
Why: cheapest way to let users *actually* invest; distribution-native monetisation. *Rejected now: SEBI RIA
(advisory fees, heavy), direct stockbroking (needs separate licence — offer later via broker partner like smallcase).*

**D-11  Insurance near-term = tech + discovery layer ON TOP OF a licensed partner.** Build the whole UX;
the regulated sale is owned by an embedded-insurance partner (Zopper/Riskcovry) or broker via their quote/issue
APIs. Go live without our own licence, validate, then decide the licence path. Why: fastest compliant path to
revenue. Longer-term option: **IRDAI Corporate Agent** (₹50L net worth, ≤9 insurers/line, own the margin — CRED
model). *Rejected: selling/collecting premium ourselves before licensed (illegal).*

**D-12  Insurance applications are INTENT-ONLY today.** Real catalogue + ranking + **indicative** premiums +
in-app application (`insurance_applications`) shown as "submitted — issuance activating soon." No premium
collected, no policy issued. Why: legal until the corporate-agent licence / partner API is live. Going live
changes only the data source + issue/pay step — **no UI/engine rebuild.**

**D-13  Compliance wording is enforced in the UI.** Badge "★ Matches your inputs" (not "Recommended"),
"Lowest indicative premium here" (not "Best-priced for you"), CTA "Continue with our licensed partner." Why:
"best/cheapest/we recommend/we're your advisor" cross IRDAI + SEBI lines.

**D-14  CA feature stays a PRIVATE user↔own-CA tool — never a marketplace.** Code-based handshake + document
sharing only. Why: ICAI bans CA advertising/solicitation, aggregator listings, and fee-sharing with non-members.
So: no CA discovery/listing/ratings/quotes, and **never take commission from CAs — monetise the user.**
*Rejected: CA marketplace/directory (ICAI violation).*

**D-15  Data residency + DPDP posture.** Supabase Postgres **Mumbai** for India residency; consent ledger,
JSON export, hard delete, AA revocation, audit log built. Why: PayWatch is a Data Fiduciary under DPDP 2023.
*To formalise: standalone consent notice, breach process, grievance officer, under-18 parental consent.*

**D-16  Keep AA on mock until FIU.** Bank data via statement upload, not live AA pull. Why: live AA needs
**FIU** registration (Sahamati + Finvu). *Rejected: wiring live AA before registration.*

---

## C. Technical / architecture

**D-17  Money in paise everywhere.** Integer paise in DB + server; format at the UI edge only. Why: avoids
float rounding errors in financial math. *Rejected: storing rupees as floats/decimals in the app layer.*

**D-18  Mobile OTP auth + short JWT + rotating refresh, tokens in localStorage.** 15-min access / 90-day
rotating refresh; OTP never returned to client. Why: low-friction for Indian users (no passwords), rotation
limits refresh-token theft blast radius. *Rejected: password auth, long-lived access tokens.*

**D-19  One codebase for web + mobile (Next.js static export + Capacitor).** Same screens, wrapped natively
with biometric lock/splash/haptics/push. Why: a solo founder can't maintain two apps; the native layer is a thin
`lib/native.ts` that no-ops on web. **Consequence:** mobile "version" = a build step (`cap:sync`), not separate
code — but the native artifact goes stale until you re-run it (see WORKFLOW §8). *Rejected: separate React
Native / native apps (2–3× the work).*

**D-20  Idempotent SQL schema + Pre-Deploy migrate.** `schema.sql` is all `CREATE IF NOT EXISTS` / `ALTER ADD
COLUMN IF NOT EXISTS`; Railway Pre-Deploy runs `migrate:prod`. Why: additive changes ship with a normal push,
no manual migration. *Caveat: non-additive changes (drop/rename/type) still need hand-run SQL.*

**D-21  Deterministic, unit-tested engines for all money math (149 assertions).** Tax/score/networth/filing
are pure functions, no DB, tested (`calc/engines/services/branches/guardrails/middleware/webparsers`). Why:
correctness is existential for a finance app; pure functions are testable without infra. AI is used only for
*reading documents* and *Q&A*, never for the core computation. *Rejected: LLM-computed tax/score (non-deterministic,
unauditable).*

**D-22  AI reads documents but the user always confirms before save.** `docAI.analyzeDocumentGeneric` (Claude)
identifies + validates doc type + reads fields + `readable` flag; deterministic `parsePayslip`/`parseForm16`
fallback when no API key. Why: layout-robust extraction without trusting the model blindly; graceful degradation.

**D-23  Every write recalculates the score + saves a RAG note.** Single funnel `recalculateAndStoreScore()`.
Why: keeps the score and Ask PayWatch always consistent with the latest data. *If you add a write path and skip
this, you ship stale numbers.*

**D-24  Reverse-on-delete for records.** Each record stores a `contribution` JSONB (prev tax_data + txn
fingerprints) so deletion restores prior state and warns with `affects[]`. Why: uploads mutate shared `tax_data`;
deletes must be safely reversible. *Rejected: irreversible merges (corrupts the tax picture).*

**D-25  Statement import de-duplicated by fingerprint, inside a transaction.** sha256(date+amount+dir+desc) +
partial-unique index; `withTransaction()` for ACID. Why: users re-upload overlapping statements; dupes would
inflate spend and corrupt the score.

**D-26  SWR read cache + SSE push, cache busted on every write.** `swr()` renders instantly then refreshes;
`/v1/events` SSE pushes a tiny signal (not data) so CA/user threads refresh live. Why: the app felt slow
refetching on every nav; caching + push fixes it without ever showing stale post-write numbers.

**D-27  App-layer AES-256-GCM encryption at rest for sensitive files/messages.** `encryption.ts` (server-held
`ENCRYPTION_KEY`) for CA docs, vault, records, insurance policies. Why: protects against a DB/storage breach.
*Note: NOT end-to-end — server can decrypt to show a CA the client's docs (by design).* *Rejected: plaintext at rest.*

**D-28  Deferred loading curtains + subtle nav bar (not forced full-screen).** `LoadingScreen` reveals only if
loading > 200ms; global nav = a thin top progress bar. Why: forced curtains felt heavy on fast/cached loads;
they should appear only when data genuinely takes time.

---

## D. Business / founder / go-to-market

**D-29  Incubate at MAHE Innovation Centre first.** Why: mentor (Dr. Mohammed Zuber / Dr. Mathew Peter),
help on trademark/registration/interns/workspace, credibility. Now moving to validation + commercialisation (TRL 7).

**D-30  Join the XElevate Super Accelerator (Cohort 3).** Accepted Aug 2026; 60% scholarship, net fee ₹50,000.
Why: the next stage is validation/adoption/scale/investor-readiness, which is exactly the accelerator's value —
and the hard part (the product) is already built. *Weighed: "post loudly now" vs stay heads-down → chose to
delay the public LinkedIn announcement until trademark is filed + there's traction (stronger, safer post).*

**D-31  Pricing restructure (Jul 2026): drop Family, add Free anchor, charm prices + struck "regular."**
Free ₹0 (anchor) · Starter ₹199 (was ₹349) · CFO ₹499 (was ₹799, "Most popular"). Why: Free anchors the paid
tiers; charm pricing + struck regular price creates a launch-discount pull; Family was never built. *DB CHECK
still lists `family` for back-compat; migrate stragglers `UPDATE users SET plan='cfo' WHERE plan='family'`.*

**D-32  First hire = Market & User Research intern (Vighnesh), task-based, ₹8–10k/mo merit stipend.** Why: the
current need is validation (competitor/user research), not marketing/content/design (those come post-validation).
Stipend range rewards quality (research, deliverables, method, turnaround, initiative). *Held off on Product &
Feedback (overlaps founder + research intern) and Finance/Domain (revisit only for a strong candidate; founder to
skill up on the tax/compliance engine first before directing that work).*

**D-33  Company structure: Private Limited (leaning), registered in hometown with local CA/CS help.** Why:
the only structure VCs fund (equity shares/ESOPs), and what regulators expect for licences (corporate-agent net
worth). Needs 2 directors/shareholders → add a trusted hometown family member/co-founder with a small stake while
keeping control. *Rejected: OPC (can't take VC, must convert), LLP (VCs won't fund), sole proprietorship
(unlimited liability, not fundable). Also do Startup India (DPIIT).* *(Not yet incorporated — confirm with the attorney/CA.)*

**D-34  Intern documentation handled via the IC pre-incorporation.** Since PayWatch isn't registered, the IC
registers the intern and issues the internship letter on the founder's recommendation; founder mails induction +
completion. Why: can't issue a company-letterhead offer/certificate before incorporation; protects against
mis-issuing documents. Stipend is PayWatch's own call (paid by founder from 22 Aug start).

**D-35  Trademark before heavy public promotion.** File "PayWatch" (classes 9/36/42) with IP India via the
attorney (Mr. Pranav Bhat) before loud launch. Why: promote a name we have a claim to; avoid weakening the IP
position. *Placement note: IC confirmed no MIT placement-cell bar on having a registered startup; manageable via
shutting/transferring directorship if a placement offer is taken.*

**D-36  Vision shift (Oct 2026): "one money brain that turns every dream into a plan."** After mentor sessions
(Upendra Namburi, XElevate) the product leads with the user's *life* — dreams and experiences (a trip, a café, parents'
health, a gol gappa) — and money/insurance/tax/investing become invisible enablers handled in the background. Primary
persona "Daisy": 22–30 first earners, small-town & metro, phone-first, no advisor. Why: people don't want to manage
money; delight and engagement come from life outcomes. *Rejected: leading with "CFO / finance app" (tracking framing,
red ocean vs FOLO/Jumpp/INDmoney).*

**D-37  The Money Brain is the single source of truth.** `services/brain/` (money map → dreams plan → life events →
ranked next moves) feeds the dashboard, Dreams page, alerts and Ask PayWatch, so every surface tells the same story
with the same numbers. Goal alerts now come from the brain's plan; one `liquidReserve()` definition (savings + liquid
funds + FDs) is shared by score, actions, alerts, investment and the brain. Why: a finance product that contradicts
itself loses trust instantly. *Rejected: each page computing its own view.*

**D-38  Dreams are stored as goals (meta.kind / meta.priority) — no new table.** Why: zero migration, chat goal-creation
and existing routes keep working. Plan waterfall is fixed and explainable: safety net (≤50% of free cash) → future-you
floor (10% if no SIP) → joy budget (10%, guilt-free) → dreams by priority then date; completed dreams cascade their money
to the next. *Rejected: optimiser/black-box allocation (unexplainable to a beginner and to a regulator).*

**D-39  "Can I afford it?" is deterministic, never guessed by the LLM.** `affordCheck()` returns yes-now / yes-by /
stretch / not-yet + the dreams it would squeeze + levers; Ask PayWatch injects the verdict and the AI must lead with it.
Why: affordability is the most emotional, most-asked question — it must be exact and consistent. Growth assumptions are
conservative by horizon (6–10%) and labelled as planning estimates, not returns (SEBI lane).

**D-40  Build launch-ready behind seams; stop research-only mode.** Every external dependency (AA bank data, insurance
quote/issue, MF execution, ERI e-filing, SMS, email, payments, push, storage) has a mock/live seam and is listed in
`GET /v1/brain/readiness` with what flips it live. Why: the founder can't get licences/APIs/real data yet, but the product
must be one "link the API" away from launch. Research continues in parallel, time-boxed (see STRATEGY.md).

**D-41  "Personal financial advisor" tagline — owner's choice, with a guardrail.** The owner chose the line for the promo;
because PayWatch is not a SEBI RIA, public surfaces carry "Not a SEBI-registered investment adviser", and the in-app copy
avoids "advisor" claims (Ask PayWatch no longer promises "human advisor review"). Revisit with counsel (Pranav) before
public launch; personalised allocation/SIP suggestions may count as "financial planning" under the IA Regulations →
options: RIA partner, own RIA registration, or keep investing educational.

**D-42  Login = email OTP until SMS is legal for us.** Indian SMS OTP needs TRAI DLT (needs an incorporated company).
Email OTP via Resend; only OTP-proven emails can log in; one-tap demo login for mentors/reviewers (fake-data persona,
re-seeded each login). Supabase tables locked with RLS + revoked anon/authenticated access in the idempotent schema.

---

## E. Reversals / revisits log
*(Add an entry here whenever a past decision is changed, with the date and reason.)*
- D-31 pricing supersedes the earlier Family-plan model; D-03 supersedes an earlier "replace your CA" framing.
- **Oct 2026:** D-36 supersedes the "CFO in your pocket / finance OS" lead message (D-01 remains true underneath —
  the OS is now the invisible brain behind dreams). Research recommends testing a ₹999/yr plan + free trial alongside
  D-31 monthly prices (56-interview willingness-to-pay data).
