-- LexFlow CPD Academy, PostgreSQL 15+. Apply by a privileged migration operator.
-- This migration is NOT executed by the application.
BEGIN;
CREATE TABLE IF NOT EXISTS cpd_users (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 3 AND 250),
  role text NOT NULL CHECK (role IN ('learner','faculty','admin')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cpd_course_sessions (
  id uuid PRIMARY KEY,
  course text NOT NULL,
  course_version text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('planned','running','completed','cancelled')),
  public boolean NOT NULL DEFAULT false,
  approval_id uuid,
  CHECK (ends_at > starts_at)
);
CREATE TABLE IF NOT EXISTS cpd_session_faculty (
  session_id uuid NOT NULL REFERENCES cpd_course_sessions(id) ON DELETE RESTRICT,
  faculty_id text NOT NULL REFERENCES cpd_users(id) ON DELETE RESTRICT,
  PRIMARY KEY (session_id, faculty_id)
);
CREATE TABLE IF NOT EXISTS cpd_enrolments (
  session_id uuid NOT NULL REFERENCES cpd_course_sessions(id) ON DELETE RESTRICT,
  learner_id text NOT NULL REFERENCES cpd_users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled','completed','withdrawn')),
  assessment_verified boolean NOT NULL DEFAULT false,
  PRIMARY KEY (session_id, learner_id)
);
CREATE TABLE IF NOT EXISTS cpd_attendance_events (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES cpd_course_sessions(id) ON DELETE RESTRICT,
  learner_id text NOT NULL REFERENCES cpd_users(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('self-checkin','faculty-attestation')),
  faculty_id text REFERENCES cpd_users(id) ON DELETE RESTRICT,
  evidence text,
  status text NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified','pending-compliance-review','approved','rejected')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((event_type='faculty-attestation' AND faculty_id IS NOT NULL AND evidence IS NOT NULL)
      OR (event_type='self-checkin' AND faculty_id IS NULL))
);
CREATE TABLE IF NOT EXISTS cpd_course_approvals (
  id uuid PRIMARY KEY,
  course_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','approved','expired','revoked')),
  credits numeric(5,2) NOT NULL DEFAULT 0 CHECK (credits >= 0),
  verified_by text NOT NULL,
  authority_reference text,
  valid_until date,
  CHECK (status <> 'approved' OR (authority_reference IS NOT NULL AND valid_until IS NOT NULL))
);
ALTER TABLE cpd_course_sessions ADD CONSTRAINT fk_cpd_session_approval
  FOREIGN KEY (approval_id) REFERENCES cpd_course_approvals(id) ON DELETE RESTRICT;
CREATE TABLE IF NOT EXISTS cpd_certificates (
  reference_hash char(64) PRIMARY KEY,
  learner_id text NOT NULL REFERENCES cpd_users(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL REFERENCES cpd_course_sessions(id) ON DELETE RESTRICT,
  course text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  issued_by text NOT NULL REFERENCES cpd_users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','revoked')),
  nba_credits numeric(5,2) NOT NULL DEFAULT 0,
  approval_id uuid REFERENCES cpd_course_approvals(id) ON DELETE RESTRICT,
  UNIQUE (learner_id,session_id)
);
CREATE TABLE IF NOT EXISTS cpd_audit_events (
  id uuid PRIMARY KEY,
  actor_id text NOT NULL,
  action text NOT NULL,
  target text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cpd_attendance_session ON cpd_attendance_events(session_id,learner_id,occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_cpd_audit_recorded ON cpd_audit_events(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_cpd_sessions_public ON cpd_course_sessions(public,starts_at);
COMMIT;
