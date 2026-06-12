import { config, PLANS, PlanKey } from '../config';

// Billing adapter. "sandbox" simulates the Razorpay Subscriptions
// lifecycle (create → authenticated → active) so the product is fully
// demoable. "razorpay" calls the live Subscriptions API.
//
// GST note: subscriptions attract 18% GST. We store base, GST and total
// separately and issue a sequential GST invoice for every charge.

export interface CreatedSubscription {
  providerSubId: string;
  shortUrl?: string; // hosted checkout link (live mode)
  status: 'created' | 'active';
}

export async function createSubscription(plan: PlanKey, cycle: 'monthly' | 'annual'): Promise<CreatedSubscription> {
  if (config.billingProvider === 'razorpay') {
    const keyId = process.env.RAZORPAY_KEY_ID || '';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    // In live mode, plan IDs must be pre-created in the Razorpay dashboard
    // and mapped via env: RAZORPAY_PLAN_STARTER etc.
    const planId = process.env[`RAZORPAY_PLAN_${plan.toUpperCase()}`] || '';
    const res = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: planId, total_count: cycle === 'annual' ? 1 : 120, customer_notify: 1 }),
    });
    if (!res.ok) throw new Error(`Razorpay error: ${res.status} ${await res.text()}`);
    const data: any = await res.json();
    return { providerSubId: data.id, shortUrl: data.short_url, status: 'created' };
  }
  // sandbox mode — immediately active
  return { providerSubId: `sub_sandbox_${Date.now().toString(36)}`, status: 'active' };
}

export function planAmount(plan: PlanKey, cycle: 'monthly' | 'annual'): number {
  const monthly = PLANS[plan].monthly;
  // Annual = 10 months price for 12 months access (2 months free)
  return cycle === 'annual' ? monthly * 10 : monthly;
}

export function gstBreakup(totalInclusive: number): { base: number; gst: number; total: number } {
  // Prices are GST-inclusive. 18% GST: base = total / 1.18
  const base = Math.round(totalInclusive / 1.18);
  return { base, gst: totalInclusive - base, total: totalInclusive };
}
