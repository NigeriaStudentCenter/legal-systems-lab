-- Phase 9: AI legal practitioner readiness diagnostic (fictional development only).
-- Privileged operator applies AFTER migrations 001-003; runtime has no DDL permission.
-- Only a learner's scored result and six domain aggregate scores are retained,
-- not individual question/answer choices. No direct NBA-ICLE access is granted.
BEGIN;
CREATE TABLE cpd_readiness_results (
 id uuid PRIMARY KEY,
 learner_id text NOT NULL REFERENCES cpd_users(id) ON DELETE RESTRICT,
 version varchar(64) NOT NULL CHECK (version='legal-ai-readiness-v1'),
 score smallint NOT NULL CHECK (score BETWEEN 0 AND 12),
 maximum smallint NOT NULL DEFAULT 12 CHECK (maximum=12),
 band varchar(20) NOT NULL CHECK (band IN ('foundation','developing','advanced')),
 domain_scores jsonb NOT NULL CHECK (jsonb_typeof(domain_scores)='object'),
 completed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cpd_readiness_learner_time ON cpd_readiness_results(learner_id,completed_at DESC);
CREATE INDEX cpd_readiness_version_time ON cpd_readiness_results(version,completed_at DESC);
COMMIT;
-- OPERATOR ACTION: separately GRANT SELECT, INSERT on
-- cpd_readiness_results to lexflow_cpd_runtime (no UPDATE/DELETE/DDL).
-- Restrict and audit administrative access; no participant data to NBA-ICLE
-- without formal approved reporting and legitimate processing basis.
