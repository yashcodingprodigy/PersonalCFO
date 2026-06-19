-- PayWatch — PostgreSQL schema v1
-- All monetary values stored in paise (₹1 = 100 paise) to avoid float errors.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  user_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile             VARCHAR(13) UNIQUE NOT NULL,
  name               VARCHAR(100),
  city               VARCHAR(100),
  age                INTEGER,
  employment_type    VARCHAR(20) CHECK (employment_type IN ('salaried','self_employed','freelancer','business','student')),
  annual_gross_income BIGINT,
  monthly_take_home  BIGINT,
  dependents_count   INTEGER DEFAULT 0,
  plan               VARCHAR(10) NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter','cfo','family')),
  plan_status        VARCHAR(20) NOT NULL DEFAULT 'trial' CHECK (plan_status IN ('trial','active','grace_period','paused','cancelled')),
  subscription_id    VARCHAR(64),
  aa_consent_handle  VARCHAR(64),
  onboarding_status  JSONB NOT NULL DEFAULT '{"session_1":"pending","session_2":"pending","session_3":"pending"}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);

-- Additive columns (idempotent) — safe to re-run on an existing database.
ALTER TABLE users ADD COLUMN IF NOT EXISTS state         VARCHAR(60);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email         VARCHAR(160);
ALTER TABLE users ADD COLUMN IF NOT EXISTS risk_appetite VARCHAR(20)
  CHECK (risk_appetite IN ('conservative','moderate','aggressive'));

-- Allow 'student' as an employment type (idempotent: drop + re-add the CHECK).
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_employment_type_check;
ALTER TABLE users ADD CONSTRAINT users_employment_type_check
  CHECK (employment_type IN ('salaried','self_employed','freelancer','business','student'));

CREATE TABLE IF NOT EXISTS otp_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile      VARCHAR(13) NOT NULL,
  code_hash   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  consumed    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_mobile ON otp_codes(mobile, created_at DESC);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS profiles (
  user_id     UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  version     INTEGER NOT NULL DEFAULT 1,
  assets      JSONB NOT NULL DEFAULT '{}',
  liabilities JSONB NOT NULL DEFAULT '{}',
  insurance   JSONB NOT NULL DEFAULT '{}',
  tax_data    JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS score_history (
  score_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  score                 INTEGER NOT NULL,
  savings_rate_score    INTEGER NOT NULL,
  insurance_score       INTEGER NOT NULL,
  investment_score      INTEGER NOT NULL,
  emergency_fund_score  INTEGER NOT NULL,
  debt_health_score     INTEGER NOT NULL,
  tax_efficiency_score  INTEGER NOT NULL,
  trigger               VARCHAR(30) NOT NULL,
  profile_snapshot      JSONB,
  calculated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_score_user ON score_history(user_id, calculated_at DESC);

CREATE TABLE IF NOT EXISTS actions (
  action_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  rule_id       VARCHAR(20),
  title         VARCHAR(120) NOT NULL,
  body          TEXT NOT NULL,
  impact_text   TEXT NOT NULL,
  impact_score  INTEGER NOT NULL DEFAULT 0,
  dimension     VARCHAR(30) NOT NULL,
  difficulty    VARCHAR(10) NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
  deadline      DATE,
  category      VARCHAR(20) NOT NULL,
  is_seasonal   BOOLEAN NOT NULL DEFAULT false,
  referral_link TEXT,
  status        VARCHAR(15) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','skipped','deferred')),
  deferred_until DATE,
  source        VARCHAR(10) NOT NULL DEFAULT 'rule',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_actions_user ON actions(user_id, status);
ALTER TABLE actions ADD COLUMN IF NOT EXISTS priority VARCHAR(10) NOT NULL DEFAULT 'medium';

CREATE TABLE IF NOT EXISTS goals (
  goal_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  goal_type      VARCHAR(30) NOT NULL,
  name           VARCHAR(100) NOT NULL,
  target_amount  BIGINT NOT NULL,
  target_date    DATE,
  current_amount BIGINT NOT NULL DEFAULT 0,
  monthly_contribution BIGINT NOT NULL DEFAULT 0,
  meta           JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  txn_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  txn_date    DATE NOT NULL,
  description TEXT NOT NULL,
  amount      BIGINT NOT NULL,
  direction   VARCHAR(6) NOT NULL CHECK (direction IN ('debit','credit')),
  category    VARCHAR(30) NOT NULL DEFAULT 'unknown',
  source      VARCHAR(20) NOT NULL DEFAULT 'manual',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_txn_user ON transactions(user_id, txn_date DESC);
-- De-duplication: a content hash per transaction. Partial unique index allows
-- existing NULL-fingerprint rows (AA/legacy) but blocks duplicate re-imports.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_txn_user_fp ON transactions(user_id, fingerprint) WHERE fingerprint IS NOT NULL;

CREATE TABLE IF NOT EXISTS conversations (
  conversation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title           VARCHAR(140) NOT NULL DEFAULT 'New conversation',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  message_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  role            VARCHAR(10) NOT NULL CHECK (role IN ('user','assistant')),
  content         TEXT NOT NULL,
  citations       JSONB NOT NULL DEFAULT '[]',
  review_status   VARCHAR(20) NOT NULL DEFAULT 'ai_only',
  engine          VARCHAR(20) NOT NULL DEFAULT 'claude',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, created_at);

-- Local RAG store. user_id NULL = global knowledge base.
CREATE TABLE IF NOT EXISTS rag_documents (
  doc_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(user_id) ON DELETE CASCADE,
  kind       VARCHAR(30) NOT NULL,
  title      VARCHAR(200) NOT NULL,
  content    TEXT NOT NULL,
  source_tag VARCHAR(60) NOT NULL DEFAULT 'Standard planning rule',
  effective_date DATE,
  tsv        tsvector,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rag_tsv ON rag_documents USING gin(tsv);
CREATE INDEX IF NOT EXISTS idx_rag_user ON rag_documents(user_id);

CREATE OR REPLACE FUNCTION rag_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW.tsv := to_tsvector('english', coalesce(NEW.title,'') || ' ' || coalesce(NEW.content,''));
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rag_tsv ON rag_documents;
CREATE TRIGGER trg_rag_tsv BEFORE INSERT OR UPDATE ON rag_documents
FOR EACH ROW EXECUTE FUNCTION rag_tsv_update();

CREATE TABLE IF NOT EXISTS subscriptions (
  subscription_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  plan             VARCHAR(10) NOT NULL,
  billing_cycle    VARCHAR(10) NOT NULL DEFAULT 'monthly',
  status           VARCHAR(20) NOT NULL DEFAULT 'active',
  provider         VARCHAR(20) NOT NULL DEFAULT 'sandbox',
  provider_sub_id  VARCHAR(64),
  amount           BIGINT NOT NULL,
  current_period_end TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  invoice_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  invoice_number VARCHAR(30) NOT NULL,
  description  TEXT NOT NULL,
  base_amount  BIGINT NOT NULL,
  gst_amount   BIGINT NOT NULL,
  total_amount BIGINT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consents (
  consent_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  consent_type VARCHAR(40) NOT NULL,
  granted     BOOLEAN NOT NULL,
  meta        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Proactive alerts / monitor (the recurring-value engine).
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  kind         VARCHAR(40) NOT NULL,
  category     VARCHAR(20) NOT NULL DEFAULT 'general',
  severity     VARCHAR(10) NOT NULL DEFAULT 'info',
  title        VARCHAR(180) NOT NULL,
  body         TEXT NOT NULL,
  action_label VARCHAR(60),
  action_href  VARCHAR(80),
  due_date     DATE,
  dedupe_key   VARCHAR(140) NOT NULL,
  status       VARCHAR(12) NOT NULL DEFAULT 'unread' CHECK (status IN ('unread','read','dismissed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_dedupe ON notifications(user_id, dedupe_key);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, status, created_at DESC);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ;

-- Document vault (organisational — metadata, status & expiry reminders).
CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  slot        VARCHAR(40) NOT NULL,
  label       VARCHAR(140) NOT NULL,
  status      VARCHAR(12) NOT NULL DEFAULT 'have' CHECK (status IN ('have','missing')),
  expiry_date DATE,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_docs_user ON documents(user_id);

-- Push notification device tokens (one user can have several devices).
CREATE TABLE IF NOT EXISTS device_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  platform   VARCHAR(10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_devicetok ON device_tokens(user_id, token);

CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID,
  event      VARCHAR(60) NOT NULL,
  meta       JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
