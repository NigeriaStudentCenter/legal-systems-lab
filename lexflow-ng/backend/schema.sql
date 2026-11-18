-- LexFlow NG PostgreSQL/PostGIS schema — initial backend design, not deployed.
-- WARNING: NO real police information or custody/client records in the public repository.
-- Apply in a privately networked PostgreSQL instance after security review.
BEGIN;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE station_verification AS ENUM ('unverified', 'corroborated', 'confirmed');
CREATE TYPE lawyer_verification AS ENUM ('pending', 'under_review', 'verified', 'suspended', 'rejected');
CREATE TYPE referral_status AS ENUM ('received', 'pending_assignment', 'accepted', 'in_progress', 'closed', 'cancelled');
CREATE TYPE service_kind AS ENUM ('custody', 'bail', 'court', 'legal_aid');

CREATE TABLE stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL CHECK(length(display_name) BETWEEN 3 AND 200),
  formation_kind text NOT NULL CHECK(formation_kind IN ('division','station','post','specialist')),
  state_name text NOT NULL,
  lga_name text,
  address_public text,
  point geography(Point,4326),
  provenance text NOT NULL,
  source_observed_on date,
  verification station_verification NOT NULL DEFAULT 'unverified',
  verified_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stations_point_gix ON stations USING gist(point);
CREATE INDEX stations_state_idx ON stations(state_name) WHERE active;
CREATE INDEX stations_name_idx ON stations(lower(display_name));

-- Identity provider subject is external: do not store passwords in the application database.
CREATE TABLE professional_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_subject text NOT NULL UNIQUE,
  display_name text NOT NULL,
  enrolment_reference_ciphertext bytea,
  practice_area text[] NOT NULL DEFAULT ARRAY[]::text[],
  languages text[] NOT NULL DEFAULT ARRAY[]::text[],
  point geography(Point,4326),
  radius_km integer NOT NULL DEFAULT 15 CHECK(radius_km BETWEEN 1 AND 500),
  accepting_matters boolean NOT NULL DEFAULT false,
  legal_aid_interest boolean NOT NULL DEFAULT false,
  verification lawyer_verification NOT NULL DEFAULT 'pending',
  verified_at timestamptz,
  last_reverified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX professional_profiles_point_gix ON professional_profiles USING gist(point);

CREATE TABLE verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES professional_profiles(id),
  reviewer_subject text NOT NULL,
  action text NOT NULL,
  evidence_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Strictly separate confidential legal intake from public directory.
CREATE TABLE referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_subject text NOT NULL,
  station_id uuid REFERENCES stations(id),
  assigned_professional_id uuid REFERENCES professional_profiles(id),
  service service_kind NOT NULL,
  urgency text NOT NULL CHECK(urgency IN ('urgent','routine')),
  status referral_status NOT NULL DEFAULT 'received',
  consent_record_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX referrals_requester_idx ON referrals(requester_subject, created_at DESC);
CREATE INDEX referrals_assignee_idx ON referrals(assigned_professional_id, created_at DESC);

CREATE TABLE referral_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES referrals(id) ON DELETE RESTRICT,
  actor_subject text NOT NULL,
  event_type text NOT NULL,
  event_time timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX referral_events_ref_idx ON referral_events(referral_id,event_time DESC);

CREATE TABLE legal_aid_programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name text NOT NULL,
  eligibility_summary text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  verified_at timestamptz
);

-- No broad public SELECT grants for confidential tables.
REVOKE ALL ON referrals,referral_events,verification_events FROM PUBLIC;
COMMIT;

-- Example matching query template (run with parameterised values in the protected API):
-- SELECT id, display_name, ST_Distance(point, ST_SetSRID(ST_MakePoint(:lon,:lat),4326)::geography)/1000 AS km
-- FROM professional_profiles
-- WHERE verification='verified' AND accepting_matters AND point IS NOT NULL
-- AND ST_DWithin(point,ST_SetSRID(ST_MakePoint(:lon,:lat),4326)::geography,:radius_km*1000)
-- ORDER BY km ASC LIMIT 30;
