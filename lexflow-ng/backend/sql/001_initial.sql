-- LexFlow NG schema, PostgreSQL >= 15. Apply through an operator-controlled migration process.
-- This database stores only professional onboarding data. No client matters or evidence.
BEGIN;
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oidc_subject text UNIQUE NOT NULL CHECK (length(oidc_subject) BETWEEN 3 AND 250),
  role text NOT NULL DEFAULT 'applicant' CHECK (role IN ('applicant','reviewer','publisher','compliance_admin')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS lawyer_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES app_users(id) ON DELETE RESTRICT,
  full_name varchar(110) NOT NULL,
  state text NOT NULL,
  city varchar(75) NOT NULL,
  year_of_call integer NOT NULL CHECK (year_of_call BETWEEN 1960 AND 2100),
  practice_areas text[] NOT NULL,
  languages text[] NOT NULL,
  summary varchar(350) NOT NULL,
  privacy_acknowledged_at timestamptz NOT NULL,
  verification_authorised_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','verified','rejected','suspended')),
  published boolean NOT NULL DEFAULT false,
  verification_valid_until date,
  verified_at timestamptz,
  published_at timestamptz,
  approved_for_publication_by uuid REFERENCES app_users(id),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT publication_requires_verification CHECK (
    NOT published OR (status = 'verified' AND verification_valid_until IS NOT NULL AND approved_for_publication_by IS NOT NULL)
  )
);
CREATE TABLE IF NOT EXISTS verification_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES lawyer_applications(id) ON DELETE RESTRICT,
  reviewer_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('approve','reject')),
  verification_source text CHECK (verification_source IN ('nba_digital_licence','nba_annual_list','other_official')),
  source_reference text,
  checked_on date,
  valid_until date,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, reviewer_user_id),
  CONSTRAINT approved_reviews_have_evidence CHECK (
    (decision='approve' AND verification_source IS NOT NULL AND source_reference IS NOT NULL AND checked_on IS NOT NULL AND valid_until IS NOT NULL AND rejection_reason IS NULL)
    OR
    (decision='reject' AND rejection_reason IS NOT NULL AND verification_source IS NULL AND source_reference IS NULL AND checked_on IS NULL AND valid_until IS NULL)
  )
);
CREATE TABLE IF NOT EXISTS audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  target_application_id uuid REFERENCES lawyer_applications(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (length(action) BETWEEN 3 AND 80),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_applications_public
  ON lawyer_applications (state, verification_valid_until)
  WHERE published = true AND status = 'verified';
CREATE INDEX IF NOT EXISTS idx_applications_pending
  ON lawyer_applications (status, created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_application
  ON verification_reviews (application_id);
CREATE INDEX IF NOT EXISTS idx_audit_target
  ON audit_events (target_application_id, recorded_at DESC);
COMMIT;
