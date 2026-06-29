-- PayWatch — PostgreSQL schema v1
-- All monetary values stored in paise (₹1 = 100 paise) to avoid float errors.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  user_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile             VARCHAR(13) UNIQUE NOT NULL,
  name               VARCHAR(100),
  city               VARCHAR(100),
  age                INTEGER,
  employment_type    VARCHAR(20) CHECK (employment_type IN ('salaried','self_employed','freelancer','business','student','both')),
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
-- Shareable connect-code so a CA can link to this user (and vice-versa).
ALTER TABLE users ADD COLUMN IF NOT EXISTS connect_code VARCHAR(12);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_connect_code ON users(connect_code) WHERE connect_code IS NOT NULL;

-- ── CA (Chartered Accountant) portal ────────────────────────────────
CREATE TABLE IF NOT EXISTS cas (
  ca_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile         VARCHAR(13) UNIQUE NOT NULL,
  name           VARCHAR(120) NOT NULL,
  email          VARCHAR(160),
  firm_name      VARCHAR(160),
  icai_number    VARCHAR(40),
  city           VARCHAR(100),
  connect_code   VARCHAR(12) UNIQUE NOT NULL,
  verified       BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);
-- Optional practice details (individual CAs may have none of these).
ALTER TABLE cas ADD COLUMN IF NOT EXISTS frn            VARCHAR(40);
ALTER TABLE cas ADD COLUMN IF NOT EXISTS cop_number     VARCHAR(40);
ALTER TABLE cas ADD COLUMN IF NOT EXISTS office_address VARCHAR(300);
ALTER TABLE cas ADD COLUMN IF NOT EXISTS website        VARCHAR(200);
ALTER TABLE cas ADD COLUMN IF NOT EXISTS gstin          VARCHAR(20);

-- The connection handshake: a CA and a user are linked once both sides agree.
CREATE TABLE IF NOT EXISTS ca_client_links (
  link_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ca_id        UUID NOT NULL REFERENCES cas(ca_id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  status       VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','rejected','revoked')),
  initiated_by VARCHAR(4) NOT NULL CHECK (initiated_by IN ('ca','user')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ca_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_links_ca ON ca_client_links(ca_id, status);
CREATE INDEX IF NOT EXISTS idx_links_user ON ca_client_links(user_id, status);
-- Shared ITR document checklist: { docKey: { sent: bool, received: bool } }.
ALTER TABLE ca_client_links ADD COLUMN IF NOT EXISTS itr_checklist JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS ca_messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id    UUID NOT NULL REFERENCES ca_client_links(link_id) ON DELETE CASCADE,
  sender     VARCHAR(4) NOT NULL CHECK (sender IN ('ca','user')),
  body       TEXT NOT NULL,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_camsg_link ON ca_messages(link_id, created_at);

-- Shared documents: metadata here, the file itself in Supabase Storage.
CREATE TABLE IF NOT EXISTS ca_documents (
  document_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id      UUID NOT NULL REFERENCES ca_client_links(link_id) ON DELETE CASCADE,
  uploaded_by  VARCHAR(4) NOT NULL CHECK (uploaded_by IN ('ca','user')),
  file_name    VARCHAR(200) NOT NULL,
  mime_type    VARCHAR(100),
  size_bytes   BIGINT,
  storage_path VARCHAR(300) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cadoc_link ON ca_documents(link_id, created_at);

-- Allow 'student' and 'both' (salaried + business) as employment types
-- (idempotent: drop + re-add the CHECK).
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_employment_type_check;
ALTER TABLE users ADD CONSTRAINT users_employment_type_check
  CHECK (employment_type IN ('salaried','self_employed','freelancer','business','student','both'));

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
-- Optional encrypted file attached to a vault entry (stored in Supabase Storage).
ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_path VARCHAR(300);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_name    VARCHAR(200);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type    VARCHAR(100);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS size_bytes   BIGINT;

-- Monthly financial records — the recurring documents a user uploads each month
-- (payslip, bank statement, demat/holdings, capital gains) so the app and the
-- user's CA get the complete money-flow picture. The raw file is AES-256
-- encrypted in Supabase Storage; `extracted` holds the user-confirmed
-- structured data parsed from it.
CREATE TABLE IF NOT EXISTS monthly_records (
  record_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  period       VARCHAR(7) NOT NULL,                 -- 'YYYY-MM'
  doc_type     VARCHAR(40) NOT NULL,                -- payslip | bank_statement | demat_holdings | capital_gains | ...
  label        VARCHAR(160) NOT NULL,
  file_name    VARCHAR(200),
  mime_type    VARCHAR(100),
  size_bytes   BIGINT,
  storage_path VARCHAR(300),
  extracted    JSONB NOT NULL DEFAULT '{}',         -- user-confirmed structured data
  summary      TEXT,                                -- one-line human summary
  contribution JSONB NOT NULL DEFAULT '{}',         -- what this record changed (for reversal on delete)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_monthly_user ON monthly_records(user_id, period DESC);
ALTER TABLE monthly_records ADD COLUMN IF NOT EXISTS contribution JSONB NOT NULL DEFAULT '{}';

-- Insurance policies the user uploads. The policy PDF is AES-256 encrypted in
-- Supabase Storage; `extracted` holds the AI-read structured data the user
-- confirmed. Drives the insurance cover analysis and expiry/renewal alerts.
CREATE TABLE IF NOT EXISTS insurance_policies (
  policy_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  category      VARCHAR(30) NOT NULL,          -- term_life | health | motor | personal_accident | critical_illness | home | travel | life_endowment | other
  insurer       VARCHAR(160),
  plan_name     VARCHAR(200),
  policy_number VARCHAR(80),
  holder_name   VARCHAR(160),
  nominee       VARCHAR(160),
  sum_assured   BIGINT,                        -- paise (cover amount / sum insured)
  premium       BIGINT,                        -- paise
  premium_frequency VARCHAR(12),               -- monthly | quarterly | yearly | single
  issue_date    DATE,
  start_date    DATE,
  expiry_date   DATE,
  maturity_date DATE,
  renewal_date  DATE,
  status        VARCHAR(12) NOT NULL DEFAULT 'active',  -- active | lapsed
  file_name     VARCHAR(200),
  mime_type     VARCHAR(100),
  size_bytes    BIGINT,
  storage_path  VARCHAR(300),
  extracted     JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_insurance_user ON insurance_policies(user_id, expiry_date);

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
