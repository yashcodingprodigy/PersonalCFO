// Account Aggregator adapter.
//
// "mock" mode simulates the RBI AA consent flow and returns realistic
// consented data so the product loop is demonstrable end-to-end.
//
// "finvu" mode is the integration point for the Finvu AA gateway. Going
// live requires FIU registration via Sahamati — see docs/COMPLIANCE.md.
// The interface below is shaped to Finvu's consent + FI data fetch flow
// so the swap is configuration, not a rewrite.

import { config } from '../config';

export interface AaConsentSession {
  consentHandle: string;
  redirectUrl: string;
  status: 'PENDING' | 'ACTIVE' | 'REVOKED';
}

export async function initiateConsent(userId: string, mobile: string): Promise<AaConsentSession> {
  if (config.aaProvider === 'finvu') {
    throw new Error('Finvu AA requires FIU registration credentials. Set AA_PROVIDER=mock for sandbox.');
  }
  return {
    consentHandle: `aa_mock_${userId.slice(0, 8)}_${Date.now().toString(36)}`,
    redirectUrl: `/aa/mock-consent?handle=aa_mock_${userId.slice(0, 8)}`,
    status: 'PENDING',
  };
}

export interface AaFetchedData {
  accounts: { bank: string; type: string; balance: number; maskedNumber: string }[];
  transactions: { date: string; description: string; amount: number; direction: 'debit' | 'credit' }[];
}

// Mock data generator — deterministic per user so refreshes look stable.
export async function fetchConsentedData(consentHandle: string, monthlyTakeHome: number): Promise<AaFetchedData> {
  const income = monthlyTakeHome || 10000000; // default ₹1L
  const today = new Date();
  const txns: AaFetchedData['transactions'] = [];
  for (let m = 2; m >= 0; m--) {
    const base = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const iso = (d: number) => new Date(base.getFullYear(), base.getMonth(), d).toISOString().slice(0, 10);
    txns.push({ date: iso(1), description: 'SALARY CREDIT NEFT', amount: income, direction: 'credit' });
    txns.push({ date: iso(3), description: 'SIP CAMS-MF AUTOPAY', amount: Math.round(income * 0.08), direction: 'debit' });
    txns.push({ date: iso(5), description: 'HOME LOAN EMI NACH', amount: Math.round(income * 0.25), direction: 'debit' });
    txns.push({ date: iso(7), description: 'SWIGGY ORDER', amount: 64500, direction: 'debit' });
    txns.push({ date: iso(9), description: 'BIGBASKET GROCERIES', amount: 412000, direction: 'debit' });
    txns.push({ date: iso(12), description: 'NETFLIX SUBSCRIPTION', amount: 64900, direction: 'debit' });
    txns.push({ date: iso(14), description: 'UBER TRIP', amount: 38000, direction: 'debit' });
    txns.push({ date: iso(16), description: 'AMAZON PURCHASE', amount: 289900, direction: 'debit' });
    txns.push({ date: iso(20), description: 'BESCOM ELECTRICITY', amount: 185000, direction: 'debit' });
    txns.push({ date: iso(22), description: 'ZOMATO ORDER', amount: 78400, direction: 'debit' });
    txns.push({ date: iso(25), description: 'HDFC LIFE PREMIUM', amount: 250000, direction: 'debit' });
    txns.push({ date: iso(27), description: 'ATM WITHDRAWAL', amount: 500000, direction: 'debit' });
  }
  return {
    accounts: [
      { bank: 'HDFC Bank', type: 'savings', balance: Math.round(income * 2.4), maskedNumber: 'XXXX4521' },
    ],
    transactions: txns,
  };
}

export function categorise(description: string): string {
  const d = description.toUpperCase();
  const rules: [RegExp, string][] = [
    [/SALARY|NEFT.*SAL/i, 'salary'],
    [/SIP|CAMS|ZERODHA|GROWW|KFIN|MUTUAL/i, 'investments'],
    [/LIC|HDFC LIFE|ICICI PRU|MAX LIFE|PREMIUM|INSURANCE/i, 'investments'],
    [/EMI|NACH.*LOAN|LOAN/i, 'emi'],
    [/SWIGGY|ZOMATO|RESTAURANT|BIGBASKET|DMART|GROCER|EATS/i, 'food_dining'],
    [/UBER|OLA|FASTAG|HPCL|IOCL|BPCL|METRO|FUEL/i, 'transport'],
    [/NETFLIX|HOTSTAR|PRIME|SPOTIFY|BOOKMYSHOW|STEAM/i, 'entertainment'],
    [/AMAZON|FLIPKART|MYNTRA|NYKAA|AJIO/i, 'shopping'],
    [/BESCOM|AIRTEL|JIO|BWSSB|ELECTRICITY|BROADBAND|DTH|GAS/i, 'utilities'],
    [/PHARM|1MG|APOLLO|PRACTO|HOSPITAL|CLINIC|LAB/i, 'health'],
    [/SCHOOL|COURSERA|UDEMY|UNIVERSITY|TUITION|FEES/i, 'education'],
    [/ATM|CASH/i, 'atm_cash'],
    [/UPI|IMPS|TRANSFER/i, 'transfers'],
  ];
  for (const [re, cat] of rules) if (re.test(d)) return cat;
  return 'unknown';
}
