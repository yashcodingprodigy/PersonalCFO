// The recurring documents PayWatch collects each month (same list as the web app).
export type DocType = {
  type: string; icon: string; label: string; sub: string;
  formats: string[]; cadence: string; category: string; salary?: 'monthly' | 'annual';
};
// Categories rendered in this order. The full set mirrors what an Indian
// taxpayer needs for a complete money picture + accurate ITR (income, TDS
// credits, investments, deductions, loans, assets and business).
export const CATEGORIES = [
  'Income & salary', 'Tax statements', 'Banking & spending', 'Investments',
  'Loans', 'Deductions & tax-saving proofs', 'Insurance & property', 'Business & self-employed',
];
export const DOC_TYPES: DocType[] = [
  // Income & salary
  { type: 'employment_contract', icon: '📜', label: 'Employment contract / offer letter', sub: 'Role, joining date and the CTC you agreed.', formats: ['pdf'], cadence: 'Once', category: 'Income & salary' },
  { type: 'employment_letter', icon: '📃', label: 'Salary structure / breakup letter', sub: 'Your CTC broken into basic, HRA and allowances.', formats: ['pdf'], cadence: 'Yearly', category: 'Income & salary', salary: 'annual' },
  { type: 'payslip', icon: '🧾', label: 'Monthly payslip', sub: 'Including reimbursements. We read it to project your tax.', formats: ['pdf'], cadence: 'Monthly', category: 'Income & salary', salary: 'monthly' },
  { type: 'form16', icon: '📄', label: 'Form 16 (TDS certificate)', sub: 'Your employer’s year-end salary & tax certificate.', formats: ['pdf'], cadence: 'Yearly', category: 'Income & salary', salary: 'annual' },
  { type: 'form16a', icon: '📑', label: 'Form 16A (non-salary TDS)', sub: 'TDS on FD/RD interest, professional fees, etc.', formats: ['pdf'], cadence: 'Quarterly', category: 'Income & salary' },
  // Tax statements
  { type: 'form26as_ais', icon: '📊', label: 'Form 26AS & AIS', sub: 'The tax dept’s record of your income & TDS — to cross-check.', formats: ['pdf'], cadence: 'Quarterly', category: 'Tax statements' },
  // Banking & spending
  { type: 'bank_statement', icon: '🏦', label: 'Bank statement', sub: 'We read every transaction to map your money flow.', formats: ['pdf', 'xlsx', 'xls', 'csv'], cadence: 'Monthly', category: 'Banking & spending' },
  { type: 'credit_card_statement', icon: '💳', label: 'Credit-card statement', sub: 'Adds your card spending to the picture.', formats: ['pdf', 'xlsx', 'xls', 'csv'], cadence: 'Monthly', category: 'Banking & spending' },
  // Investments
  { type: 'demat_holdings', icon: '📈', label: 'Demat / MF holdings', sub: 'A look-through of what you own and how diversified you are.', formats: ['xlsx', 'xls', 'csv'], cadence: 'Monthly', category: 'Investments' },
  { type: 'mutual_fund_cas', icon: '🗂️', label: 'Mutual-fund statement (CAS)', sub: 'CAMS/KFintech consolidated statement of all your funds.', formats: ['pdf'], cadence: 'Monthly', category: 'Investments' },
  { type: 'capital_gains', icon: '💹', label: 'Capital-gains statement', sub: 'Realised short- and long-term gains from your broker P&L.', formats: ['xlsx', 'xls', 'csv'], cadence: 'Yearly', category: 'Investments' },
  { type: 'dividend_statement', icon: '💰', label: 'Dividend statement', sub: 'Dividends received — taxable as other income.', formats: ['pdf'], cadence: 'Yearly', category: 'Investments' },
  { type: 'interest_certificate', icon: '🪙', label: 'Bank / FD interest certificate', sub: 'Savings + FD interest and any TDS on it.', formats: ['pdf'], cadence: 'Yearly', category: 'Investments' },
  // Loans
  { type: 'home_loan_certificate', icon: '🏠', label: 'Home-loan interest certificate', sub: 'Principal (80C) and interest (24b) split — big deductions.', formats: ['pdf'], cadence: 'Yearly', category: 'Loans' },
  { type: 'other_loan_statement', icon: '💸', label: 'Other loan certificate', sub: 'Education (80E), personal or car loan interest statement.', formats: ['pdf'], cadence: 'Yearly', category: 'Loans' },
  // Deductions & tax-saving proofs
  { type: 'rent_receipts', icon: '🏘️', label: 'Rent receipts + landlord PAN', sub: 'For HRA. Landlord PAN needed if rent > ₹1L/yr.', formats: ['pdf'], cadence: 'Yearly', category: 'Deductions & tax-saving proofs' },
  { type: 'tax_saving_80c', icon: '🧮', label: '80C proofs', sub: 'PPF, ELSS, LIC, tuition fees, tax-saver FD receipts.', formats: ['pdf'], cadence: 'Yearly', category: 'Deductions & tax-saving proofs' },
  { type: 'health_insurance_80d', icon: '🩺', label: 'Health-insurance premium (80D)', sub: 'Premium receipt for you and your family/parents.', formats: ['pdf'], cadence: 'Yearly', category: 'Deductions & tax-saving proofs' },
  { type: 'nps_statement', icon: '🏛️', label: 'NPS statement (80CCD)', sub: 'Your NPS contributions — extra ₹50k deduction.', formats: ['pdf'], cadence: 'Yearly', category: 'Deductions & tax-saving proofs' },
  { type: 'donation_80g', icon: '🎁', label: 'Donation receipts (80G)', sub: 'Eligible donations with the donee’s PAN.', formats: ['pdf'], cadence: 'Yearly', category: 'Deductions & tax-saving proofs' },
  // Insurance & property
  { type: 'insurance_policy', icon: '🛡️', label: 'Insurance policy', sub: 'Life or health policy — for your cover analysis.', formats: ['pdf'], cadence: 'Once', category: 'Insurance & property' },
  { type: 'property_papers', icon: '🏡', label: 'Property deed / agreement', sub: 'Sale/purchase deed — needed for property capital gains.', formats: ['pdf'], cadence: 'Once', category: 'Insurance & property' },
  // Business & self-employed
  { type: 'gst_returns', icon: '🏢', label: 'GST return (GSTR-1 / 3B)', sub: 'For business income — turnover and tax paid.', formats: ['pdf'], cadence: 'Monthly', category: 'Business & self-employed' },
  { type: 'profit_loss', icon: '📉', label: 'Profit & loss / balance sheet', sub: 'Your business’s yearly accounts.', formats: ['pdf'], cadence: 'Yearly', category: 'Business & self-employed' },
];

