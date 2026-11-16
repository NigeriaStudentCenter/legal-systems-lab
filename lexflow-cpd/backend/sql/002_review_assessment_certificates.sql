-- LexFlow CPD Academy, migration 002. Apply after 001 by a privileged migration operator.
-- Adds: independent review of faculty attendance attestations, assessment submissions with
-- faculty decisions, certificate issue/revocation fields, and AI tutor usage metering.
-- Safe to apply while the previous API image is running: it only adds tables, columns and
-- constraints that existing rows already satisfy.
BEGIN;

-- Name shown to faculty and printed on certificates. Taken from the sign-in token's `name`
-- claim, which the user can edit: a verified legal name is still needed before real use.
ALTER TABLE cpd_users ADD COLUMN IF NOT EXISTS display_name varchar(120);

-- 1. Attendance: a learner's self check-in can never become verified attendance. Only a
-- faculty attestation can be approved, and only by someone other than the attesting faculty.
ALTER TABLE cpd_attendance_events ADD CONSTRAINT self_checkin_never_verified
  CHECK (event_type = 'faculty-attestation' OR status = 'unverified');
ALTER TABLE cpd_attendance_events ADD CONSTRAINT uq_attendance_event_faculty UNIQUE (id, faculty_id);
CREATE TABLE IF NOT EXISTS cpd_attendance_reviews (
  attendance_id uuid PRIMARY KEY,
  attested_by text NOT NULL,
  reviewer_id text NOT NULL REFERENCES cpd_users(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('approved','rejected')),
  reason varchar(500),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  -- Ties the review to the attestation AND to the faculty member who made it.
  FOREIGN KEY (attendance_id, attested_by) REFERENCES cpd_attendance_events(id, faculty_id) ON DELETE RESTRICT,
  CONSTRAINT reviewer_is_not_attester CHECK (reviewer_id <> attested_by),
  CONSTRAINT rejection_needs_reason CHECK (decision = 'approved' OR reason IS NOT NULL)
);

-- 2. Assessments: one open submission per learner per session; a faculty decision closes it.
CREATE TABLE IF NOT EXISTS cpd_assessment_submissions (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL,
  learner_id text NOT NULL,
  response text NOT NULL CHECK (length(response) BETWEEN 20 AND 6000),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','passed','failed')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (session_id, learner_id) REFERENCES cpd_enrolments(session_id, learner_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cpd_open_submission
  ON cpd_assessment_submissions(session_id, learner_id) WHERE status = 'submitted';
CREATE TABLE IF NOT EXISTS cpd_assessment_decisions (
  submission_id uuid PRIMARY KEY REFERENCES cpd_assessment_submissions(id) ON DELETE RESTRICT,
  faculty_id text NOT NULL REFERENCES cpd_users(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('pass','fail')),
  score smallint NOT NULL CHECK (score BETWEEN 0 AND 10),
  feedback varchar(2000) NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  -- Pass mark 7/10 from the Assessment Centre rubric; the course director must confirm it.
  CONSTRAINT pass_needs_pass_mark CHECK (decision = 'fail' OR score >= 7)
);

-- 3. Certificates: a printable reference, the name as issued, revocation, and no credits
-- without a linked course approval.
ALTER TABLE cpd_certificates
  ADD COLUMN IF NOT EXISTS reference varchar(40) UNIQUE,
  ADD COLUMN IF NOT EXISTS learner_name varchar(120),
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by text REFERENCES cpd_users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS revoke_reason varchar(500);
ALTER TABLE cpd_certificates ADD CONSTRAINT revocation_complete CHECK (
  (status = 'issued' AND revoked_at IS NULL AND revoked_by IS NULL AND revoke_reason IS NULL)
  OR (status = 'revoked' AND revoked_at IS NOT NULL AND revoked_by IS NOT NULL AND revoke_reason IS NOT NULL));
ALTER TABLE cpd_certificates ADD CONSTRAINT credits_need_approval
  CHECK (nba_credits = 0 OR approval_id IS NOT NULL);

-- 4. AI tutor metering for daily caps. Questions and answers are NOT stored.
CREATE TABLE IF NOT EXISTS cpd_tutor_usage (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES cpd_users(id) ON DELETE RESTRICT,
  used_on date NOT NULL DEFAULT current_date,
  requested_at timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending','answered','failed')),
  prompt_tokens integer NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
  completion_tokens integer NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0)
);
CREATE INDEX IF NOT EXISTS idx_cpd_tutor_usage_day ON cpd_tutor_usage(used_on, user_id);

CREATE INDEX IF NOT EXISTS idx_cpd_attendance_pending ON cpd_attendance_events(status, occurred_at)
  WHERE event_type = 'faculty-attestation';
COMMIT;
