import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  env: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/paywatch',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-in-production',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-only-refresh-secret',
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenTtlDays: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '90', 10),
  smsProvider: process.env.SMS_PROVIDER || 'dev',
  billingProvider: process.env.BILLING_PROVIDER || 'sandbox',
  aaProvider: process.env.AA_PROVIDER || 'mock',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '',
  supabaseBucket: process.env.SUPABASE_BUCKET || 'ca-documents',
  emailProvider: process.env.EMAIL_PROVIDER || 'dev',
  resendApiKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || 'PayWatch <noreply@paywatch.in>',
  appUrl: process.env.APP_URL || 'https://paywatch.in',
  cronSecret: process.env.CRON_SECRET || '',
  fcmServerKey: process.env.FCM_SERVER_KEY || '',
  // Firebase service-account JSON (string) for FCM HTTP v1 push delivery.
  firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT || '',
  isDev: (process.env.NODE_ENV || 'development') !== 'production',
  // One-tap demo login (POST /auth/demo) into a seeded, fake-data persona.
  // On by default; set DEMO_LOGIN=off to disable. Real SMS OTP needs TRAI DLT
  // registration (needs an incorporated entity), so this is how reviewers/
  // mentors try the app until then.
  demoLoginEnabled: (process.env.DEMO_LOGIN || 'on') !== 'off',
  demoMobile: process.env.DEMO_MOBILE || '+919000000001',
};

// Fail fast in production if signing secrets were left at their dev defaults —
// default JWT secrets would let anyone forge access tokens.
if (config.env === 'production') {
  const weak: string[] = [];
  if (config.jwtSecret.startsWith('dev-only')) weak.push('JWT_SECRET');
  if (config.jwtRefreshSecret.startsWith('dev-only')) weak.push('JWT_REFRESH_SECRET');
  if (weak.length) {
    throw new Error(`Refusing to start: set a strong ${weak.join(' and ')} env var in production (currently the insecure dev default).`);
  }
  if (config.corsOrigin === '*') console.warn('[security] CORS_ORIGIN is "*" in production — set explicit web origins.');
}

// `monthly` = the price we actually charge (paise). `regular` = a higher
// "list" price shown struck-through for the launch-discount illusion.
export const PLANS = {
  starter: { name: 'Starter', monthly: 19900, regular: 34900, qaLimit: 5, goalLimit: 2, policyLimit: 5, actionsPerMonth: 3 },
  cfo: { name: 'CFO', monthly: 49900, regular: 79900, qaLimit: Infinity, goalLimit: Infinity, policyLimit: Infinity, actionsPerMonth: Infinity },
} as const;

export type PlanKey = keyof typeof PLANS;
