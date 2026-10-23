// Integration readiness — every external capability the brain depends on, its
// current mode, and exactly what flips it to live. The product is built so that
// going live = set env/credentials + (where noted) a licence; no rebuild.

import { config } from '../../config';

export interface Capability {
  key: string;
  name: string;
  mode: 'live' | 'mock' | 'off';
  powers: string;                 // what it feeds in the product
  goLive: string;                 // what's needed to switch to live
  seam: string;                   // where the code plugs in
}

export function integrationReadiness(): Capability[] {
  return [
    { key: 'ai', name: 'AI reasoning (Claude)', mode: config.anthropicApiKey ? 'live' : 'mock',
      powers: 'Ask PayWatch answers, document reading', goLive: 'ANTHROPIC_API_KEY (deterministic fallbacks always on)', seam: 'services/cfo-ai.ts, services/docAI.ts' },
    { key: 'bank', name: 'Bank data (Account Aggregator)', mode: config.aaProvider === 'mock' ? 'mock' : 'live',
      powers: 'Money map, spending, life events, idle cash', goLive: 'FIU registration (Sahamati) + AA partner (e.g. Finvu); AA_PROVIDER=finvu. Statement upload works today.', seam: 'adapters/aa.ts → transactions table' },
    { key: 'insurance', name: 'Insurance quotes & issuance', mode: 'mock',
      powers: 'Marketplace premiums, in-app purchase', goLive: 'Licensed partner (embedded-insurance/broker) quote + issue APIs, or own IRDAI licence', seam: 'services/insuranceMarket.ts (estimatePremium) + insurance_applications submit' },
    { key: 'mf', name: 'Mutual-fund investing', mode: 'off',
      powers: 'One-tap SIPs for dream plans', goLive: 'AMFI ARN (NISM V-A) + BSE StAR MF via infra partner', seam: 'dream plan allocations → SIP mandate (planned adapter)' },
    { key: 'efile', name: 'One-click e-filing', mode: 'off',
      powers: 'File ITR from the app', goLive: 'ERI registration with the Income Tax Dept', seam: 'services/taxFiling.ts output → ERI API (planned adapter)' },
    { key: 'email', name: 'Email (login codes, briefings)', mode: config.emailProvider === 'resend' && config.resendApiKey ? 'live' : 'mock',
      powers: 'Email OTP login, monthly briefing, alerts', goLive: 'EMAIL_PROVIDER=resend + RESEND_API_KEY + verified domain', seam: 'adapters/email.ts' },
    { key: 'sms', name: 'SMS OTP', mode: config.smsProvider === 'msg91' ? 'live' : 'mock',
      powers: 'Mobile login', goLive: 'Incorporation + TRAI DLT registration + MSG91 template', seam: 'adapters/sms.ts' },
    { key: 'payments', name: 'Subscriptions (Razorpay)', mode: config.billingProvider === 'sandbox' ? 'mock' : 'live',
      powers: 'Starter/CFO plans', goLive: 'Razorpay live KYC (needs company)', seam: 'adapters/billing.ts' },
    { key: 'push', name: 'Push notifications', mode: config.firebaseServiceAccount ? 'live' : 'off',
      powers: 'Next-move nudges on the phone', goLive: 'FIREBASE_SERVICE_ACCOUNT + native Firebase config', seam: 'adapters/push.ts' },
    { key: 'voice', name: 'Human voice + speech recognition (ElevenLabs)', mode: config.elevenLabsKey ? 'live' : 'mock',
      powers: 'Voice assistant in English & Hindi (natural voice, accurate Hindi recognition)', goLive: 'ELEVENLABS_API_KEY (+ optional ELEVENLABS_VOICE_ID / ELEVENLABS_VOICE_ID_HI). Falls back to the device voice.', seam: 'routes/voice.ts' },
    { key: 'translate', name: 'Hindi translation of every screen', mode: config.anthropicApiKey ? 'live' : 'mock',
      powers: 'Auto-translate any English text to Hindi (cached once for everyone)', goLive: 'ANTHROPIC_API_KEY (brain/core screens are hand-translated and work without it)', seam: 'services/translate.ts, routes/i18n.ts' },
    { key: 'storage', name: 'Encrypted document storage', mode: config.supabaseUrl && config.supabaseServiceKey ? 'live' : 'off',
      powers: 'Vault, records, CA sharing, policies', goLive: 'SUPABASE_URL + SUPABASE_SERVICE_KEY + private bucket', seam: 'adapters/storage.ts' },
  ];
}
