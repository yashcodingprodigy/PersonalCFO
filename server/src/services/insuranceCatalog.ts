// Insurance plan catalogue — a curated database of REAL plans across insurers
// and categories, with their public features and claim-settlement ratios.
//
// COMPLIANCE (see CLAUDE.md §8): this is EDUCATIONAL comparison information, not
// solicitation or advice. PayWatch itself is not (yet) an IRDAI-registered
// insurance intermediary — the model is a tech + discovery layer ON TOP OF a
// licensed insurance partner:
//   • premiums shown are INDICATIVE estimates (see insuranceMarket.ts), NOT live
//     insurer quotes — a live quote needs the partner's / insurer's API;
//   • the "buy" step captures the user's INTENT (insurance_applications) and, when
//     live, hands off to our IRDAI-licensed partner who owns the quote, KYC,
//     payment, issuance and servicing. No premium is collected in-app today.
// Claim ratios / features are from public/IRDAI sources and must be re-verified —
// they change yearly. `verifyNote` is surfaced in the UI.

export type PlanCategory =
  | 'term_life' | 'health' | 'personal_accident' | 'critical_illness' | 'motor' | 'home' | 'travel';

export interface InsurancePlan {
  id: string;
  category: PlanCategory;
  insurer: string;
  plan: string;
  claimRatioPct?: number;     // CSR (life) / claim-settlement (general), public/IRDAI — approximate
  highlights: string[];       // key public features
  tags: string[];             // matched against the user's needs for the "best fit" ranking
  entryAgeMin?: number;
  entryAgeMax?: number;
  basePerLakh: number;        // ₹/year per ₹1L cover for a ~30yo (indicative premium model)
  buyUrl: string;             // insurer's own page — compliant hand-off
}

export const CATEGORY_LABEL: Record<PlanCategory, string> = {
  term_life: 'Term life', health: 'Health', personal_accident: 'Personal accident',
  critical_illness: 'Critical illness', motor: 'Car (motor)', home: 'Home / property', travel: 'Travel',
};

export const CATALOG: InsurancePlan[] = [
  // ── Term life ───────────────────────────────────────────────────────
  { id: 'tl-maxlife-smart', category: 'term_life', insurer: 'Axis Max Life', plan: 'Smart Term Plan Plus',
    claimRatioPct: 99.65, entryAgeMin: 18, entryAgeMax: 65, basePerLakh: 120,
    highlights: ['One of the highest claim-settlement ratios', 'Critical-illness cover (up to 64 illnesses) as a rider', 'Zero-cost exit option', 'Smart Cover: 1.5× cover for the first 15 years'],
    tags: ['high claim ratio', 'riders', 'critical illness'], buyUrl: 'https://www.maxlifeinsurance.com/term-insurance-plans' },
  { id: 'tl-hdfc-c2p', category: 'term_life', insurer: 'HDFC Life', plan: 'Click 2 Protect Super',
    claimRatioPct: 99.5, entryAgeMin: 18, entryAgeMax: 65, basePerLakh: 125,
    highlights: ['Flexible payout options (lump sum / income)', 'Critical-illness & accidental-death riders', 'Return-of-premium and waiver-of-premium options', 'Top-up cover at life stages'],
    tags: ['high claim ratio', 'riders', 'flexible payout'], buyUrl: 'https://www.hdfclife.com/term-insurance-plans' },
  { id: 'tl-icici-iprotect', category: 'term_life', insurer: 'ICICI Prudential', plan: 'iProtect Smart',
    claimRatioPct: 99.17, entryAgeMin: 18, entryAgeMax: 65, basePerLakh: 105,
    highlights: ['Very competitive premiums', 'Terminal-illness cover built in', 'Critical-illness & accidental-death benefit options', 'Wide entry age'],
    tags: ['low premium', 'critical illness', 'value'], buyUrl: 'https://www.iciciprulife.com/term-insurance-plans.html' },
  { id: 'tl-tata-srs', category: 'term_life', insurer: 'Tata AIA', plan: 'Sampoorna Raksha Supreme',
    claimRatioPct: 99.13, entryAgeMin: 18, entryAgeMax: 70, basePerLakh: 115,
    highlights: ['Vitality wellness programme with premium discounts', 'Fast claim settlement (hours, for eligible claims)', 'Multiple payout & cover-continuance options', 'Whole-life cover option'],
    tags: ['wellness discount', 'fast claim', 'riders'], buyUrl: 'https://www.tataaia.com/life-insurance-plans/term-insurance.html' },
  { id: 'tl-bajaj-spg', category: 'term_life', insurer: 'Bajaj Allianz Life', plan: 'Smart Protect Goal',
    claimRatioPct: 99.23, entryAgeMin: 18, entryAgeMax: 65, basePerLakh: 110,
    highlights: ['Comprehensive rider menu', 'Highest solvency ratio among peers (financial strength)', 'Increasing-cover and return-of-premium options', 'Joint-life cover available'],
    tags: ['riders', 'financial strength', 'value'], buyUrl: 'https://www.bajajallianzlife.com/term-insurance-plans.html' },
  { id: 'tl-lic-techterm', category: 'term_life', insurer: 'LIC', plan: 'Digi Term / Tech Term',
    claimRatioPct: 98.6, entryAgeMin: 18, entryAgeMax: 65, basePerLakh: 135,
    highlights: ['Trusted public-sector insurer, very large claims base', 'Level & increasing sum-assured options', 'Simple, no-frills pure term cover'],
    tags: ['trusted psu', 'simple'], buyUrl: 'https://licindia.in/web/guest/term-insurance-plans' },
  { id: 'tl-sbi-eshield', category: 'term_life', insurer: 'SBI Life', plan: 'eShield Next',
    claimRatioPct: 98.4, entryAgeMin: 18, entryAgeMax: 65, basePerLakh: 118,
    highlights: ['Level / increasing / future-proofing cover options', 'Auto cover increase at life stages', 'Backed by SBI group'],
    tags: ['trusted psu', 'increasing cover'], buyUrl: 'https://www.sbilife.co.in/en/individual-life-insurance/protection-plans' },

  // ── Health (family floater) ─────────────────────────────────────────
  { id: 'h-hdfcergo-optima', category: 'health', insurer: 'HDFC Ergo', plan: 'Optima Secure',
    claimRatioPct: 96.7, entryAgeMin: 18, entryAgeMax: 65, basePerLakh: 720,
    highlights: ['No room-rent cap', 'Up to 2× cover (Secure benefit) + Restore benefit', 'Unlimited reinstatement of sum insured', '10,000+ cashless hospitals'],
    tags: ['no room rent cap', 'restore benefit', 'high cover'], buyUrl: 'https://www.hdfcergo.com/health-insurance' },
  { id: 'h-star-fho', category: 'health', insurer: 'Star Health', plan: 'Family Health Optima',
    claimRatioPct: 90, entryAgeMin: 18, entryAgeMax: 65, basePerLakh: 640,
    highlights: ['Cost-effective for young families', 'Maternity & AYUSH cover', 'Strong pre/post-hospitalisation cover', 'Automatic restoration of sum insured'],
    tags: ['low premium', 'maternity', 'ayush'], buyUrl: 'https://www.starhealth.in/health-insurance/family-health-optima' },
  { id: 'h-niva-reassure', category: 'health', insurer: 'Niva Bupa', plan: 'ReAssure 2.0',
    claimRatioPct: 91.6, entryAgeMin: 18, entryAgeMax: 65, basePerLakh: 700,
    highlights: ['ReAssure: unlimited sum-insured restoration (any illness, any member)', 'Booster: unclaimed cover carries forward up to 10×', 'Lock the clock — premium by entry age', '10,000+ network hospitals'],
    tags: ['restore benefit', 'carry forward', 'modern'], buyUrl: 'https://www.nivabupa.com/health-insurance-plans/reassure.html' },
  { id: 'h-care-supreme', category: 'health', insurer: 'Care Health', plan: 'Care Supreme',
    claimRatioPct: 91, entryAgeMin: 18, entryAgeMax: 65, basePerLakh: 680,
    highlights: ['Strong claim settlement', 'Unlimited recharge of sum insured', 'No-claim bonus up to large multiples', 'Wide hospital network'],
    tags: ['high claim ratio', 'no claim bonus', 'value'], buyUrl: 'https://www.careinsurance.com/health-insurance-plans.html' },
  { id: 'h-icici-elevate', category: 'health', insurer: 'ICICI Lombard', plan: 'Elevate',
    claimRatioPct: 90, entryAgeMin: 18, entryAgeMax: 65, basePerLakh: 700,
    highlights: ['Power Booster — unlimited carry-forward', 'No room-rent limit', 'Add-ons: zero-cost claims, unlimited reset', 'Large cashless network'],
    tags: ['no room rent cap', 'carry forward', 'add-ons'], buyUrl: 'https://www.icicilombard.com/health-insurance' },
  { id: 'h-tata-medicare', category: 'health', insurer: 'Tata AIG', plan: 'Medicare',
    claimRatioPct: 95, entryAgeMin: 18, entryAgeMax: 65, basePerLakh: 690,
    highlights: ['No-claim bonus', 'Restore benefit', 'Wellness programme', 'Cashless network'],
    tags: ['no claim bonus', 'wellness'], buyUrl: 'https://www.tataaig.com/health-insurance' },
  { id: 'h-ab-activone', category: 'health', insurer: 'Aditya Birla Health', plan: 'Activ One',
    claimRatioPct: 92, entryAgeMin: 18, entryAgeMax: 65, basePerLakh: 700,
    highlights: ['Chronic-care management from day one', 'HealthReturns — earn back up to 100% of premium via wellness', '100% sum-insured reload', 'Super NCB'],
    tags: ['wellness', 'chronic care', 'reload'], buyUrl: 'https://www.adityabirlacapital.com/healthinsurance/health-insurance-plans' },

  // ── Personal accident ───────────────────────────────────────────────
  { id: 'pa-tata-accidentguard', category: 'personal_accident', insurer: 'Tata AIG', plan: 'Accident Guard',
    entryAgeMin: 18, entryAgeMax: 70, basePerLakh: 18,
    highlights: ['Accidental death + permanent/partial disability', 'Hospital cash & education benefit options', 'Worldwide cover', 'Very low premium for high cover'],
    tags: ['high cover', 'low premium', 'disability'], buyUrl: 'https://www.tataaig.com/personal-accident-insurance' },
  { id: 'pa-icici-protect', category: 'personal_accident', insurer: 'ICICI Lombard', plan: 'Personal Protect',
    entryAgeMin: 18, entryAgeMax: 80, basePerLakh: 16,
    highlights: ['Accidental death & disability cover', 'Optional weekly income on disability', 'Affordable, easy online issue'],
    tags: ['low premium', 'disability', 'income benefit'], buyUrl: 'https://www.icicilombard.com/personal-accident-insurance' },
  { id: 'pa-hdfcergo-pa', category: 'personal_accident', insurer: 'HDFC Ergo', plan: 'Personal Accident',
    entryAgeMin: 18, entryAgeMax: 70, basePerLakh: 17,
    highlights: ['Lump sum on accidental death/disability', 'Children education benefit', 'Worldwide coverage'],
    tags: ['disability', 'education benefit'], buyUrl: 'https://www.hdfcergo.com/personal-accident-insurance' },
  { id: 'pa-bajaj-premiumguard', category: 'personal_accident', insurer: 'Bajaj Allianz', plan: 'Premium Personal Guard',
    entryAgeMin: 18, entryAgeMax: 70, basePerLakh: 15,
    highlights: ['High accidental cover at low cost', 'Temporary total disability weekly benefit', 'Hospitalisation allowance'],
    tags: ['low premium', 'high cover'], buyUrl: 'https://www.bajajallianz.com/personal-accident-insurance-online.html' },

  // ── Critical illness ────────────────────────────────────────────────
  { id: 'ci-hdfcergo-ci', category: 'critical_illness', insurer: 'HDFC Ergo', plan: 'Critical Illness',
    entryAgeMin: 18, entryAgeMax: 65, basePerLakh: 450,
    highlights: ['Lump sum on diagnosis of listed critical illnesses', 'Covers cancer, cardiac, stroke, kidney failure & more', 'Money is yours to use (income/loan replacement)'],
    tags: ['lump sum', 'cancer', 'cardiac'], buyUrl: 'https://www.hdfcergo.com/health-insurance/critical-illness-insurance' },
  { id: 'ci-icici-ci', category: 'critical_illness', insurer: 'ICICI Lombard', plan: 'Critical Care',
    entryAgeMin: 18, entryAgeMax: 65, basePerLakh: 460,
    highlights: ['Covers a wide list of major illnesses', 'Single lump-sum payout on diagnosis', 'Tax benefit under 80D'],
    tags: ['lump sum', 'wide list'], buyUrl: 'https://www.icicilombard.com/health-insurance/critical-illness-insurance' },
  { id: 'ci-manipalcigna-lifestyle', category: 'critical_illness', insurer: 'Manipal Cigna', plan: 'Lifestyle Protection — Critical Care',
    entryAgeMin: 18, entryAgeMax: 65, basePerLakh: 440,
    highlights: ['Up to 30 critical illnesses', 'Multiple claim option on some variants', 'Long policy terms'],
    tags: ['many illnesses', 'multi-claim'], buyUrl: 'https://www.manipalcigna.com/critical-illness-insurance' },
  { id: 'ci-care-ci', category: 'critical_illness', insurer: 'Care Health', plan: 'Critical Illness',
    entryAgeMin: 18, entryAgeMax: 65, basePerLakh: 445,
    highlights: ['Lump sum on first diagnosis', 'Covers 32 critical illnesses', 'No medical tests up to a limit'],
    tags: ['lump sum', 'no medical'], buyUrl: 'https://www.careinsurance.com/critical-illness-insurance.html' },

  // ── Motor (car, comprehensive) ──────────────────────────────────────
  { id: 'mo-icici-comp', category: 'motor', insurer: 'ICICI Lombard', plan: 'Comprehensive Car Insurance',
    claimRatioPct: 99, basePerLakh: 0,
    highlights: ['~99% claim settlement', '6,100+ cashless garages', 'Add-ons: zero-dep, engine protect, NCB protect', 'Quick app-based claims'],
    tags: ['high claim ratio', 'cashless garages', 'add-ons'], buyUrl: 'https://www.icicilombard.com/motor-insurance/car-insurance' },
  { id: 'mo-tata-autosecure', category: 'motor', insurer: 'Tata AIG', plan: 'Auto Secure',
    claimRatioPct: 99, basePerLakh: 0,
    highlights: ['~99% claim settlement', '7,500+ cashless garages', 'Widest add-on menu (zero-dep, return-to-invoice, tyre)', 'Strong after-sales'],
    tags: ['high claim ratio', 'cashless garages', 'add-ons'], buyUrl: 'https://www.tataaig.com/motor-insurance/car-insurance' },
  { id: 'mo-bajaj-comp', category: 'motor', insurer: 'Bajaj Allianz', plan: 'Comprehensive Car Insurance',
    claimRatioPct: 98.5, basePerLakh: 0,
    highlights: ['~98.5% claim settlement', 'Strong mobile app — buy & claim in minutes', 'Wide garage network', 'On-the-spot claim settlement for small claims'],
    tags: ['app claims', 'cashless garages'], buyUrl: 'https://www.bajajallianz.com/car-insurance-online.html' },
  { id: 'mo-digit-car', category: 'motor', insurer: 'Digit', plan: 'Car Insurance',
    claimRatioPct: 96, basePerLakh: 0,
    highlights: ['Fully digital, fast self-inspection claims', 'Simple add-ons', 'Smartphone-enabled claim process'],
    tags: ['digital', 'fast claim'], buyUrl: 'https://www.godigit.com/car-insurance' },
  { id: 'mo-hdfcergo-car', category: 'motor', insurer: 'HDFC Ergo', plan: 'Car Insurance',
    claimRatioPct: 98, basePerLakh: 0,
    highlights: ['Overnight vehicle repair', 'Emergency assistance add-on', 'Large cashless garage network'],
    tags: ['cashless garages', 'add-ons'], buyUrl: 'https://www.hdfcergo.com/motor-insurance/car-insurance' },

  // ── Home / property (Bharat Griha Raksha) ───────────────────────────
  { id: 'ho-hdfcergo-home', category: 'home', insurer: 'HDFC Ergo', plan: 'Home Shield (Bharat Griha Raksha)',
    basePerLakh: 60,
    highlights: ['Covers structure + contents against fire, theft & natural disasters', 'Standard IRDAI Bharat Griha Raksha product', 'Very low premium relative to cover'],
    tags: ['structure + contents', 'low premium'], buyUrl: 'https://www.hdfcergo.com/home-insurance' },
  { id: 'ho-icici-griharaksha', category: 'home', insurer: 'ICICI Lombard', plan: 'Bharat Griha Raksha',
    basePerLakh: 60,
    highlights: ['Building + household contents cover', 'Auto-escalation of sum insured', 'Covers natural catastrophes'],
    tags: ['structure + contents', 'auto escalation'], buyUrl: 'https://www.icicilombard.com/home-insurance' },
  { id: 'ho-bajaj-home', category: 'home', insurer: 'Bajaj Allianz', plan: 'My Home Insurance',
    basePerLakh: 60,
    highlights: ['Building & contents', 'Optional jewellery / electronics cover', 'Long-term policy discounts'],
    tags: ['contents', 'long-term discount'], buyUrl: 'https://www.bajajallianz.com/home-insurance-online.html' },

  // ── Travel ──────────────────────────────────────────────────────────
  { id: 'tr-tata-travelguard', category: 'travel', insurer: 'Tata AIG', plan: 'Travel Guard',
    basePerLakh: 0,
    highlights: ['Medical + trip cover worldwide', 'Baggage loss, flight delay, passport loss', 'Schengen-compliant variants', '24×7 global assistance'],
    tags: ['worldwide', 'schengen', 'assistance'], buyUrl: 'https://www.tataaig.com/travel-insurance' },
  { id: 'tr-bajaj-travel', category: 'travel', insurer: 'Bajaj Allianz', plan: 'Travel Companion',
    basePerLakh: 0,
    highlights: ['Emergency medical cover abroad', 'Trip cancellation & baggage cover', 'Cashless hospitalisation network overseas'],
    tags: ['medical', 'trip cancellation'], buyUrl: 'https://www.bajajallianz.com/travel-insurance-online.html' },
  { id: 'tr-icici-travel', category: 'travel', insurer: 'ICICI Lombard', plan: 'Travel Insurance',
    basePerLakh: 0,
    highlights: ['Single-trip & multi-trip options', 'Medical, baggage and flight-delay cover', 'Worldwide assistance'],
    tags: ['multi-trip', 'worldwide'], buyUrl: 'https://www.icicilombard.com/travel-insurance' },
];

// What each category's policy covers (shown on cards + benefits view).
export const CATEGORY_COVERAGES: Record<PlanCategory, string[]> = {
  motor: ['Accidental damage', 'Theft', 'Fire & explosion', 'Natural disasters (flood, quake)', 'Third-party liability', 'Personal accident cover (owner-driver)'],
  health: ['In-patient hospitalisation', 'Day-care procedures', 'Pre & post hospitalisation', 'Ambulance charges', 'ICU / room charges', 'Domiciliary treatment'],
  term_life: ['Death benefit to your nominee', 'Terminal-illness benefit', 'Tax benefit u/s 80C & 10(10D)'],
  personal_accident: ['Accidental death', 'Permanent total / partial disability', 'Temporary disability income', 'Hospitalisation allowance'],
  critical_illness: ['Lump sum on diagnosis', 'Cancer, cardiac, stroke, kidney & more', 'No hospital bills needed to claim'],
  home: ['Building structure', 'Household contents', 'Fire, theft & burglary', 'Natural disasters'],
  travel: ['Emergency medical abroad', 'Trip cancellation / curtailment', 'Baggage & passport loss', 'Flight delay', '24×7 global assistance'],
};

export interface AddOn { id: string; name: string; desc: string; price: number; popular?: boolean; mandatory?: boolean }

// Optional upgrades per category (indicative ₹/year). Same menu across insurers.
export const CATEGORY_ADDONS: Partial<Record<PlanCategory, AddOn[]>> = {
  motor: [
    { id: 'zero_dep', name: 'Zero depreciation cover', desc: 'Full claim payout with no depreciation deducted on parts.', price: 3031, popular: true },
    { id: 'ncb_protect', name: 'NCB protect', desc: 'Keep your no-claim bonus even after making a claim.', price: 842 },
    { id: 'engine_protect', name: 'Engine protect', desc: 'Covers engine & gearbox damage beyond standard cover.', price: 1450 },
    { id: 'roadside', name: '24×7 roadside assistance', desc: 'Towing, fuel, flat-tyre and lockout help anytime.', price: 499 },
    { id: 'consumables', name: 'Consumables cover', desc: 'Oil, nuts, bolts and other consumables during claims.', price: 650 },
    { id: 'key_lock', name: 'Lock & key protect', desc: 'New keys/locks if they’re lost or stolen.', price: 299 },
    { id: 'rti', name: 'Return to invoice', desc: 'Get the full invoice value on total loss or theft.', price: 1200 },
    { id: 'tyre', name: 'Tyre protect', desc: 'Covers tyre damage & replacement.', price: 750 },
    { id: 'pb', name: 'Personal belongings cover', desc: 'Items stolen from inside the vehicle.', price: 94 },
  ],
  health: [
    { id: 'topup', name: 'Super top-up', desc: 'Extra cover above a threshold, very cheaply.', price: 1800, popular: true },
    { id: 'opd', name: 'OPD & diagnostics', desc: 'Doctor visits, tests and pharmacy bills.', price: 2400 },
    { id: 'maternity', name: 'Maternity & newborn', desc: 'Delivery and newborn cover (waiting period applies).', price: 3200 },
    { id: 'roomrent', name: 'Room-rent waiver', desc: 'Remove any room-rent cap on your policy.', price: 900 },
    { id: 'ci_rider', name: 'Critical-illness rider', desc: 'Lump sum on a major-illness diagnosis.', price: 1500 },
  ],
  term_life: [
    { id: 'ci', name: 'Critical-illness rider', desc: 'Lump sum on diagnosis of major illnesses.', price: 2400, popular: true },
    { id: 'adb', name: 'Accidental death benefit', desc: 'Extra payout if death is accidental.', price: 900 },
    { id: 'wop', name: 'Waiver of premium', desc: 'Future premiums waived on disability / CI.', price: 600 },
    { id: 'income', name: 'Income payout option', desc: 'Monthly income to family instead of a lump sum.', price: 1100 },
  ],
};

export const verifyNote =
  'Plans, features and claim-settlement ratios are from public/IRDAI sources and can change — always confirm the current terms on the insurer’s own page. Premiums shown are PayWatch indicative estimates, not live insurer quotes.';
