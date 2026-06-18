// Demo customer personas (data only — no DB imports), shared by the seed
// script and any verification tooling. Money in paise (₹1 = 100 paise).

export const Cr = (x: number) => Math.round(x * 1e9);   // crore  → paise
export const L = (x: number) => Math.round(x * 1e7);    // lakh   → paise
export const R = (x: number) => Math.round(x * 100);    // rupees → paise

export interface Persona {
  mobile: string;
  name: string;
  age: number;
  city: string;
  state: string;
  employment_type: 'salaried' | 'self_employed' | 'freelancer' | 'business' | 'student';
  risk_appetite: 'conservative' | 'moderate' | 'aggressive';
  annual_gross_income: number;
  monthly_take_home: number;
  dependents_count: number;
  plan: 'starter' | 'cfo' | 'family';
  plan_status: 'trial' | 'active' | 'grace_period' | 'paused' | 'cancelled';
  blurb: string;
  assets: any;
  liabilities: any;
  insurance: any;
  tax_data: any;
}

export const ONBOARDING_DONE = JSON.stringify({ session_1: 'complete', session_2: 'complete', session_3: 'complete' });

export const PERSONAS: Persona[] = [
  {
    mobile: '+919000000001', name: 'Aarav Sharma', age: 26, city: 'Bengaluru', state: 'Karnataka',
    employment_type: 'salaried', risk_appetite: 'aggressive', annual_gross_income: L(28), monthly_take_home: R(175000),
    dependents_count: 0, plan: 'starter', plan_status: 'trial',
    blurb: 'High-earning single techie, no dependents (no term needed), aggressive investor, new-regime tax.',
    assets: { savings_balance: L(4), liquid_funds: L(2), fd_total: 0, epf: L(3), ppf: R(50000), nps: 0,
      mutual_funds: { value: L(6), monthly_sip: R(25000) }, stocks: L(2), us_stocks: R(150000), gold: 0, property: 0, monthly_expenses: R(80000) },
    liabilities: { credit_cards: [{ outstanding: R(40000), limit: L(3) }] },
    insurance: { health: [{ sum_insured: L(5), employer_provided: true }], term: [] },
    tax_data: { regime: 'new', epf_contribution_annual: L(1.8), elss_annual: 0 },
  },
  {
    mobile: '+919000000002', name: 'Priya Nair', age: 34, city: 'Mumbai', state: 'Maharashtra',
    employment_type: 'salaried', risk_appetite: 'moderate', annual_gross_income: L(18), monthly_take_home: R(115000),
    dependents_count: 2, plan: 'cfo', plan_status: 'active',
    blurb: 'Married, 2 kids, home loan, ZERO term cover — should flag the #1 high-priority insurance gap. CFO (Plus) plan.',
    assets: { savings_balance: L(3), liquid_funds: L(1), fd_total: L(4), epf: L(6), ppf: L(3), nps: 0,
      mutual_funds: { value: L(8), monthly_sip: R(15000) }, stocks: 0, gold: L(2), property: L(95), monthly_expenses: R(75000) },
    liabilities: { home_loans: [{ outstanding: L(60), emi: R(52000), rate: 8.6 }], credit_cards: [{ outstanding: R(25000), limit: L(2) }] },
    insurance: { term: [], health: [{ sum_insured: L(5), employer_provided: true }] },
    tax_data: { regime: 'old', epf_contribution_annual: L(1.5), ppf_annual: L(1), home_loan_interest_annual: L(2), home_loan_principal_annual: L(1.2), health_premium_self_annual: R(25000) },
  },
  {
    mobile: '+919000000003', name: 'Rohan Mehta', age: 41, city: 'New Delhi', state: 'Delhi',
    employment_type: 'business', risk_appetite: 'moderate', annual_gross_income: L(45), monthly_take_home: R(300000),
    dependents_count: 3, plan: 'cfo', plan_status: 'active',
    blurb: 'Business owner, ~₹5Cr net worth heavily concentrated in property → diversification penalty; term gap vs 25x.',
    assets: { savings_balance: L(8), liquid_funds: L(5), fd_total: L(20), epf: 0, ppf: L(12), nps: L(8),
      mutual_funds: { value: L(25), monthly_sip: R(50000) }, stocks: L(15), gold: L(10), property: Cr(3.5), monthly_expenses: R(180000) },
    liabilities: { car_loans: [{ outstanding: L(8), emi: R(18000), rate: 9.5 }], credit_cards: [{ outstanding: L(1.2), limit: L(8) }] },
    insurance: { term: [{ sum_assured: Cr(1) }], health: [{ sum_insured: L(25) }] },
    tax_data: { regime: 'old', nps_80ccd1b_annual: R(50000), health_premium_self_annual: R(35000), health_premium_parents_annual: R(50000), parents_senior: true, ppf_annual: L(1.5) },
  },
  {
    mobile: '+919000000004', name: 'Sneha Reddy', age: 22, city: 'Hyderabad', state: 'Telangana',
    employment_type: 'student', risk_appetite: 'conservative', annual_gross_income: L(3), monthly_take_home: R(25000),
    dependents_count: 0, plan: 'starter', plan_status: 'trial',
    blurb: 'Student/intern — insurance & tax dimensions should be EXCLUDED; invest framing = start small / index funds.',
    assets: { savings_balance: R(60000), liquid_funds: 0, mutual_funds: { value: R(20000), monthly_sip: R(2000) }, monthly_expenses: R(15000) },
    liabilities: {},
    insurance: { term: [], health: [] },
    tax_data: { regime: 'new' },
  },
  {
    mobile: '+919000000005', name: 'Vikram Singh', age: 38, city: 'Pune', state: 'Maharashtra',
    employment_type: 'salaried', risk_appetite: 'moderate', annual_gross_income: L(32), monthly_take_home: R(200000),
    dependents_count: 2, plan: 'cfo', plan_status: 'active',
    blurb: 'Well-balanced, strong score; old-vs-new regime close; NPS already used — good "healthy benchmark" account.',
    assets: { savings_balance: L(6), liquid_funds: L(4), fd_total: L(6), epf: L(12), ppf: L(8), nps: L(6),
      mutual_funds: { value: L(30), monthly_sip: R(40000) }, stocks: L(5), gold: L(4), property: Cr(1.2), monthly_expenses: R(110000) },
    liabilities: { home_loans: [{ outstanding: L(35), emi: R(38000), rate: 8.4 }], credit_cards: [{ outstanding: R(30000), limit: L(5) }] },
    insurance: { term: [{ sum_assured: Cr(1.5) }], health: [{ sum_insured: L(15) }] },
    tax_data: { regime: 'old', epf_contribution_annual: L(1.5), nps_80ccd1b_annual: R(50000), ppf_annual: L(1.5), home_loan_interest_annual: L(2), health_premium_self_annual: R(28000), health_premium_parents_annual: R(30000) },
  },
  {
    mobile: '+919000000006', name: 'Ananya Iyer', age: 29, city: 'Chennai', state: 'Tamil Nadu',
    employment_type: 'freelancer', risk_appetite: 'moderate', annual_gross_income: L(14), monthly_take_home: R(95000),
    dependents_count: 0, plan: 'starter', plan_status: 'trial',
    blurb: 'Freelancer (44ADA presumptive), no emergency fund → weak emergency dim, no health cover, high card use.',
    assets: { savings_balance: L(1.5), liquid_funds: 0, mutual_funds: { value: L(3), monthly_sip: R(10000) }, stocks: L(1), gold: L(1), monthly_expenses: R(60000) },
    liabilities: { credit_cards: [{ outstanding: R(80000), limit: L(1.5) }] },
    insurance: { health: [], term: [] },
    tax_data: { regime: 'new' },
  },
  {
    mobile: '+919000000007', name: 'Karthik Krishnan', age: 45, city: 'Kochi', state: 'Kerala',
    employment_type: 'salaried', risk_appetite: 'conservative', annual_gross_income: L(22), monthly_take_home: R(140000),
    dependents_count: 3, plan: 'starter', plan_status: 'trial',
    blurb: 'Sole earner, 3 dependents + senior parents — big term gap, 80D senior-parent deduction, health top-up.',
    assets: { savings_balance: L(4), liquid_funds: L(2), fd_total: L(10), epf: L(14), ppf: L(6), nps: 0,
      mutual_funds: { value: L(6), monthly_sip: R(12000) }, gold: L(6), property: L(80), monthly_expenses: R(95000) },
    liabilities: { home_loans: [{ outstanding: L(22), emi: R(26000), rate: 8.7 }], credit_cards: [{ outstanding: R(20000), limit: L(2) }] },
    insurance: { term: [{ sum_assured: L(50) }], health: [{ sum_insured: L(7) }] },
    tax_data: { regime: 'old', epf_contribution_annual: L(1.5), ppf_annual: L(1), home_loan_interest_annual: L(1.8), health_premium_self_annual: R(25000), health_premium_parents_annual: R(50000), parents_senior: true },
  },
  {
    mobile: '+919000000008', name: 'Meera Joshi', age: 31, city: 'Ahmedabad', state: 'Gujarat',
    employment_type: 'salaried', risk_appetite: 'moderate', annual_gross_income: L(16), monthly_take_home: R(100000),
    dependents_count: 0, plan: 'starter', plan_status: 'trial',
    blurb: 'Debt-stressed: personal + car loan + 90% credit-card utilisation → poor debt health, "pay down card" action.',
    assets: { savings_balance: R(80000), liquid_funds: 0, mutual_funds: { value: L(1), monthly_sip: R(5000) }, epf: L(4), monthly_expenses: R(70000) },
    liabilities: { personal_loans: [{ outstanding: L(6), emi: R(18000), rate: 14 }], car_loans: [{ outstanding: L(5), emi: R(12000), rate: 9.5 }], credit_cards: [{ outstanding: L(1.8), limit: L(2) }] },
    insurance: { health: [{ sum_insured: L(5), employer_provided: true }], term: [] },
    tax_data: { regime: 'new' },
  },
  {
    mobile: '+919000000009', name: 'Arjun Patel', age: 52, city: 'Surat', state: 'Gujarat',
    employment_type: 'business', risk_appetite: 'conservative', annual_gross_income: L(60), monthly_take_home: R(350000),
    dependents_count: 2, plan: 'family', plan_status: 'active',
    blurb: 'High net worth (~₹6.5Cr) but low equity / property+gold heavy; retirement & estate-planning focus. Family plan.',
    assets: { savings_balance: L(15), liquid_funds: L(10), fd_total: L(60), ppf: L(20), nps: L(10), gold: L(25),
      property: Cr(5), mutual_funds: { value: L(10), monthly_sip: 0 }, stocks: L(5), monthly_expenses: R(220000) },
    liabilities: { credit_cards: [{ outstanding: R(50000), limit: L(10) }] },
    insurance: { term: [{ sum_assured: Cr(2) }], health: [{ sum_insured: L(30) }] },
    tax_data: { regime: 'old', ppf_annual: L(1.5), nps_80ccd1b_annual: R(50000), health_premium_self_annual: R(40000) },
  },
  {
    mobile: '+919000000010', name: 'Divya Menon', age: 27, city: 'Kolkata', state: 'West Bengal',
    employment_type: 'salaried', risk_appetite: 'conservative', annual_gross_income: L(9), monthly_take_home: R(62000),
    dependents_count: 0, plan: 'starter', plan_status: 'trial',
    blurb: 'Below the tax threshold (tax dim OFF), first-time investor building an emergency fund.',
    assets: { savings_balance: L(1.2), liquid_funds: 0, mutual_funds: { value: R(40000), monthly_sip: R(3000) }, epf: L(2), monthly_expenses: R(38000) },
    liabilities: { credit_cards: [{ outstanding: R(10000), limit: L(1) }] },
    insurance: { health: [{ sum_insured: L(5), employer_provided: true }], term: [] },
    tax_data: { regime: 'new' },
  },
  {
    mobile: '+919000000011', name: 'Rahul Verma', age: 36, city: 'Jaipur', state: 'Rajasthan',
    employment_type: 'salaried', risk_appetite: 'moderate', annual_gross_income: L(20), monthly_take_home: R(125000),
    dependents_count: 1, plan: 'cfo', plan_status: 'active',
    blurb: 'Classic "prepay home loan vs invest?" Ask-CFO scenario; decent all-round score.',
    assets: { savings_balance: L(5), liquid_funds: L(3), fd_total: L(5), epf: L(8), ppf: L(5), nps: 0,
      mutual_funds: { value: L(12), monthly_sip: R(20000) }, gold: L(3), property: L(70), monthly_expenses: R(80000) },
    liabilities: { home_loans: [{ outstanding: L(40), emi: R(36000), rate: 8.5 }], credit_cards: [{ outstanding: R(15000), limit: L(3) }] },
    insurance: { term: [{ sum_assured: Cr(1) }], health: [{ sum_insured: L(10) }] },
    tax_data: { regime: 'old', epf_contribution_annual: L(1.5), ppf_annual: L(1), home_loan_interest_annual: L(2), home_loan_principal_annual: L(1.2), health_premium_self_annual: R(22000) },
  },
  {
    mobile: '+919000000012', name: 'Fatima Khan', age: 30, city: 'Lucknow', state: 'Uttar Pradesh',
    employment_type: 'salaried', risk_appetite: 'moderate', annual_gross_income: L(12), monthly_take_home: R(80000),
    dependents_count: 1, plan: 'starter', plan_status: 'trial',
    blurb: 'Single parent with 1 dependent and no term cover → term gap; tight savings; just under tax threshold.',
    assets: { savings_balance: L(1.5), liquid_funds: R(50000), mutual_funds: { value: L(1.5), monthly_sip: R(6000) }, epf: L(3), monthly_expenses: R(55000) },
    liabilities: { credit_cards: [{ outstanding: R(30000), limit: L(1.5) }] },
    insurance: { term: [], health: [{ sum_insured: L(5), employer_provided: true }] },
    tax_data: { regime: 'new' },
  },
  {
    mobile: '+919000000013', name: 'Sanjay Gupta', age: 48, city: 'Indore', state: 'Madhya Pradesh',
    employment_type: 'self_employed', risk_appetite: 'conservative', annual_gross_income: L(15), monthly_take_home: R(100000),
    dependents_count: 3, plan: 'starter', plan_status: 'trial',
    blurb: 'Shopkeeper: gold + property heavy, NO insurance (term & health both zero), no formal investing → weak score.',
    assets: { savings_balance: L(2), liquid_funds: 0, fd_total: L(3), gold: L(18), property: L(60), mutual_funds: { value: 0, monthly_sip: 0 }, monthly_expenses: R(85000) },
    liabilities: {},
    insurance: { term: [], health: [] },
    tax_data: { regime: 'old' },
  },
  {
    mobile: '+919000000014', name: 'Nisha Agarwal', age: 24, city: 'Noida', state: 'Uttar Pradesh',
    employment_type: 'salaried', risk_appetite: 'moderate', annual_gross_income: L(7.5), monthly_take_home: R(52000),
    dependents_count: 0, plan: 'starter', plan_status: 'trial',
    blurb: 'First job, education loan (80E), below tax threshold — first-job checklist & building-from-zero journey.',
    assets: { savings_balance: R(90000), liquid_funds: 0, mutual_funds: { value: R(15000), monthly_sip: R(2500) }, epf: L(1), monthly_expenses: R(35000) },
    liabilities: { education_loans: [{ outstanding: L(5), emi: R(8000), rate: 9 }], credit_cards: [{ outstanding: R(8000), limit: R(50000) }] },
    insurance: { health: [{ sum_insured: L(5), employer_provided: true }], term: [] },
    tax_data: { regime: 'new', education_loan_interest_annual: R(40000) },
  },
  {
    mobile: '+919000000015', name: 'Ramesh Pillai', age: 58, city: 'Thiruvananthapuram', state: 'Kerala',
    employment_type: 'salaried', risk_appetite: 'conservative', annual_gross_income: L(26), monthly_take_home: R(160000),
    dependents_count: 1, plan: 'cfo', plan_status: 'active',
    blurb: 'Near retirement: very debt-heavy allocation (EPF/PPF/FD), low equity; retirement-corpus & leave-encashment angle.',
    assets: { savings_balance: L(6), liquid_funds: L(4), fd_total: L(25), epf: L(35), ppf: L(25), nps: L(12),
      mutual_funds: { value: L(8), monthly_sip: R(10000) }, stocks: L(2), gold: L(8), property: Cr(1.5), monthly_expenses: R(90000) },
    liabilities: { credit_cards: [{ outstanding: R(20000), limit: L(5) }] },
    insurance: { term: [{ sum_assured: L(50) }], health: [{ sum_insured: L(15) }] },
    tax_data: { regime: 'old', epf_contribution_annual: L(1.5), ppf_annual: L(1.5), nps_80ccd1b_annual: R(50000), health_premium_self_annual: R(30000) },
  },
];
