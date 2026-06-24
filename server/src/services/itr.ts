// Canonical ITR knowledge: the documents needed (with how to obtain them) and
// the steps a CA follows to file. Shared by the user document-prep guide, the
// CA filing-workflow card, and the shared CA<->client checklist.

export interface ItrDoc { key: string; name: string; who: string; how: string }

export const ITR_DOCUMENTS: ItrDoc[] = [
  { key: 'pan', name: 'PAN card', who: 'You', how: 'Your 10-character PAN, linked with Aadhaar (link on incometax.gov.in if not).' },
  { key: 'aadhaar', name: 'Aadhaar', who: 'You', how: 'Used for e-verification via OTP at filing.' },
  { key: 'form16', name: 'Form 16', who: 'Employer', how: 'Your employer issues it after the financial year ends (usually by mid-June). Download from your payroll/HR portal.' },
  { key: 'form26as_ais', name: 'Form 26AS & AIS', who: 'You', how: 'On incometax.gov.in: 26AS under e-File → Income Tax Returns → View 26AS; AIS under Services → AIS. Shows all TDS and reported income against your PAN.' },
  { key: 'bank_interest', name: 'Bank interest certificate', who: 'Bank', how: 'From net-banking → “Interest certificate / TDS certificate” — covers savings and FD interest.' },
  { key: 'capital_gains', name: 'Capital-gains statement', who: 'Broker / Fund house', how: 'Download the realised P&L / capital-gains report for the FY from your broker (Zerodha Console, Groww, etc.) or AMC/CAMS-KFintech.' },
  { key: 'deduction_proofs', name: '80C / 80D / NPS proofs', who: 'You', how: 'ELSS/PPF/LIC receipts, NPS (Tier-1) statement, and health-insurance premium receipts for the year.' },
  { key: 'home_loan', name: 'Home-loan interest certificate', who: 'Lender', how: 'From your bank/NBFC — shows the principal (80C) and interest (24b) split for the year.' },
  { key: 'rent_hra', name: 'Rent receipts + landlord PAN', who: 'You', how: 'For HRA. Keep monthly rent receipts; landlord PAN is required if annual rent exceeds ₹1 lakh.' },
  { key: 'other_income', name: 'Other income proofs', who: 'You', how: 'Dividend statements, freelance/professional invoices, rental income, interest from bonds, etc.' },
  { key: 'bank_for_refund', name: 'Bank account for refund', who: 'You', how: 'Account number + IFSC, pre-validated on the income-tax portal so any refund can be credited.' },
];

export const CA_FILING_STEPS: string[] = [
  'Collect & verify documents — PAN, Aadhaar, Form 16, 26AS/AIS, bank & capital-gains statements, deduction proofs.',
  'Reconcile income against Form 26AS / AIS and flag any mismatch with the client before proceeding.',
  'Determine the client’s residential status and the correct ITR form (ITR-1/2/3/4).',
  'Compute income under each head: salary, house property, capital gains, business/profession, other sources.',
  'Apply Chapter VI-A deductions (80C, 80D, 80CCD(1B), 24(b), 80E/80G) and HRA exemption.',
  'Compare old vs new regime and pick the lower-tax option for the client.',
  'Compute tax: slab tax, special-rate capital gains (STCG 20% / LTCG 12.5%), surcharge and 4% cess; apply the 87A rebate.',
  'Reconcile TDS/TCS + advance tax paid → arrive at refund due or self-assessment tax payable.',
  'Pay any self-assessment tax (Challan 280) before filing to avoid 234B/234C interest.',
  'Prepare and file the return on incometax.gov.in, cross-checking against the computed figures.',
  'E-verify (Aadhaar OTP / net-banking) and share the ITR-V acknowledgement with the client.',
];
