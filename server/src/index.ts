import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { authRouter } from './routes/auth';
import { userRouter } from './routes/user';
import { scoreRouter } from './routes/score';
import { actionsRouter } from './routes/actions';
import { insightsRouter } from './routes/insights';
import { goalsRouter } from './routes/goals';
import { qaRouter } from './routes/qa';
import { billingRouter } from './routes/billing';
import { complianceRouter } from './routes/compliance';
import { aaRouter } from './routes/aa';
import { reportsRouter } from './routes/reports';
import { rateLimit } from './middleware/rateLimit';

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
const corsOrigins = config.corsOrigin === '*' ? '*' : config.corsOrigin.split(',').map(o => o.trim());
app.use(cors({ origin: corsOrigins, credentials: corsOrigins !== '*' }));
app.use(express.json({ limit: '2mb' }));

// Global API rate limit (per SRS §23.3)
app.use(rateLimit({ windowMs: 60_000, max: 1000, keyPrefix: 'api' }));

app.get('/v1/health', (_req, res) => res.json({ status: 'ok', service: 'personalcfo-api', ts: new Date().toISOString() }));

app.use('/v1/auth', authRouter);
app.use('/v1/user', userRouter);
app.use('/v1/score', scoreRouter);
app.use('/v1/actions', actionsRouter);
app.use('/v1', insightsRouter);       // /networth /tax /insurance /transactions /spend
app.use('/v1/goals', goalsRouter);
app.use('/v1/qa', qaRouter);
app.use('/v1/billing', billingRouter);
app.use('/v1', complianceRouter);     // /data/export /user/me(DELETE) /consents
app.use('/v1/aa', aaRouter);
app.use('/v1/reports', reportsRouter);

// 404
app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

// Error handler — never leak internals
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'internal', message: 'Something went wrong on our side. Please try again.' });
});

app.listen(config.port, () => {
  console.log(`Personal CFO API listening on :${config.port} (${config.env})`);
  console.log(`  SMS: ${config.smsProvider} · Billing: ${config.billingProvider} · AA: ${config.aaProvider} · AI: ${config.anthropicApiKey ? 'claude' : 'rules-engine'}`);
});
