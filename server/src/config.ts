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
  emailProvider: process.env.EMAIL_PROVIDER || 'dev',
  resendApiKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || 'PayWatch <noreply@paywatch.in>',
  appUrl: process.env.APP_URL || 'https://paywatch.in',
  cronSecret: process.env.CRON_SECRET || '',
  isDev: (process.env.NODE_ENV || 'development') !== 'production',
};

export const PLANS = {
  starter: { name: 'Starter', monthly: 29900, qaLimit: 5, goalLimit: 2, policyLimit: 5, actionsPerMonth: 3 },
  cfo: { name: 'CFO', monthly: 69900, qaLimit: Infinity, goalLimit: Infinity, policyLimit: Infinity, actionsPerMonth: Infinity },
  family: { name: 'Family', monthly: 119900, qaLimit: Infinity, goalLimit: Infinity, policyLimit: Infinity, actionsPerMonth: Infinity },
} as const;

export type PlanKey = keyof typeof PLANS;
