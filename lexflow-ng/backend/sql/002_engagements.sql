-- LexFlow NG direct-to-lawyer engagements, invoices and receipts. PostgreSQL >= 15.
-- LexFlow never receives, holds or transfers legal fees. These tables RECORD what a
-- lawyer invoiced and what the lawyer and client REPORTED about payment; they are not
-- evidence that money moved. No case facts, evidence or matter narrative belong here.
BEGIN;
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
ALTER TABLE app_users ADD CONSTRAINT app_users_role_check
  CHECK (role IN ('applicant','client','reviewer','publisher','compliance_admin'));

-- Where a verified lawyer asks clients to pay. Shown to a client only after two
-- independent reviewers confirm the account name matches the verified lawyer or firm.
CREATE TABLE IF NOT EXISTS lawyer_payment_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL UNIQUE REFERENCES lawyer_applications(id) ON DELETE RESTRICT,
  method text NOT NULL CHECK (method IN ('bank_transfer','paystack_link')),
  account_name varchar(110) NOT NULL,
  bank_name varchar(80),
  account_number text CHECK (account_number ~ '^[0-9]{10}$'),
  payment_url text CHECK (payment_url ~ '^https://(paystack\.com|paystack\.shop)/pay/[A-Za-z0-9_-]{2,80}$'),
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','approved','rejected')),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT method_fields CHECK (
    (method='bank_transfer' AND bank_name IS NOT NULL AND account_number IS NOT NULL AND payment_url IS NULL)
    OR (method='paystack_link' AND payment_url IS NOT NULL AND bank_name IS NULL AND account_number IS NULL)
  )
);
CREATE TABLE IF NOT EXISTS payment_detail_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  detail_id uuid NOT NULL REFERENCES lawyer_payment_details(id) ON DELETE RESTRICT,
  detail_version integer NOT NULL,
  reviewer_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('approve','reject')),
  name_match_confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (detail_id, detail_version, reviewer_user_id),
  CONSTRAINT approval_confirms_name CHECK (decision='reject' OR name_match_confirmed)
);

CREATE TABLE IF NOT EXISTS engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  application_id uuid NOT NULL REFERENCES lawyer_applications(id) ON DELETE RESTRICT,
  -- Generic label only. Never describe the client's problem here.
  service_category text NOT NULL,
  -- Minimum needed for the chosen lawyer to reply. Visible to that lawyer only.
  client_name varchar(110) NOT NULL,
  client_contact varchar(120) NOT NULL,
  direct_payment_acknowledged_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','accepted','declined','cancelled','completed')),
  conflict_check_confirmed_at timestamptz,
  responded_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT acceptance_requires_conflict_check CHECK (
    status NOT IN ('accepted','completed') OR conflict_check_confirmed_at IS NOT NULL
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_engagements_one_open
  ON engagements (client_user_id, application_id) WHERE status IN ('requested','accepted');
CREATE INDEX IF NOT EXISTS idx_engagements_lawyer ON engagements (application_id, created_at DESC);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE RESTRICT,
  lawyer_reference varchar(40) NOT NULL,
  fee_type text NOT NULL CHECK (fee_type IN ('Consultation','Fixed-fee service','Retainer deposit','Disbursements','Other professional fees')),
  amount_kobo bigint NOT NULL CHECK (amount_kobo BETWEEN 10000 AND 1000000000000),
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'issued'
    CHECK (status IN ('issued','reported_paid','client_confirmed','disputed','void')),
  -- Snapshot of the approved payment details at the moment of issue.
  pay_method text NOT NULL CHECK (pay_method IN ('bank_transfer','paystack_link')),
  pay_account_name varchar(110) NOT NULL,
  pay_bank_name varchar(80),
  pay_account_number text,
  pay_url text,
  receipt_number text UNIQUE,
  received_on date,
  reported_paid_at timestamptz,
  client_responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engagement_id, lawyer_reference),
  CONSTRAINT receipt_requires_report CHECK (
    (status IN ('issued','void') AND receipt_number IS NULL)
    OR (status IN ('reported_paid','client_confirmed','disputed') AND receipt_number IS NOT NULL AND received_on IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_invoices_engagement ON invoices (engagement_id, created_at);
COMMIT;
