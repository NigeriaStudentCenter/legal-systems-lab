-- 003_capstone_assessment.sql
-- Apply once as privileged migration operator, OUTSIDE Azure Container Apps runtime.
-- No application DDL, no DELETE, no TRUNCATE. PostgreSQL 15+.
BEGIN;
CREATE TABLE cpd_capstone_submissions (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES cpd_course_sessions(id) ON DELETE RESTRICT,
  learner_id text NOT NULL REFERENCES cpd_users(id) ON DELETE RESTRICT,
  course_version text NOT NULL DEFAULT 'lexflow-capstone-v1',
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers)='object'),
  status text NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','returned','passed','failed')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CHECK ((status='submitted' AND decided_at IS NULL) OR status<>'submitted')
);
CREATE UNIQUE INDEX cpd_capstone_one_pending
 ON cpd_capstone_submissions(session_id,learner_id) WHERE status='submitted';
CREATE INDEX cpd_capstone_session_status
 ON cpd_capstone_submissions(session_id,status,submitted_at DESC);
CREATE INDEX cpd_capstone_learner
 ON cpd_capstone_submissions(learner_id,submitted_at DESC);
CREATE TABLE cpd_capstone_decisions (
  submission_id uuid PRIMARY KEY REFERENCES cpd_capstone_submissions(id) ON DELETE RESTRICT,
  faculty_id text NOT NULL REFERENCES cpd_users(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK(decision IN ('pass','fail','return')),
  marks jsonb NOT NULL CHECK(jsonb_typeof(marks)='object'),
  total integer NOT NULL CHECK(total BETWEEN 0 AND 100),
  feedback text NOT NULL CHECK(length(trim(feedback)) BETWEEN 10 AND 3000),
  decided_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
