-- LexFlow NG privacy controls. PostgreSQL >= 15. Apply after 002_engagements.sql.
-- Additive and backward compatible with an API image that predates it.
BEGIN;
-- 1. Which privacy notice version was in force when a person acknowledged it.
ALTER TABLE lawyer_applications ADD COLUMN IF NOT EXISTS privacy_notice_version text;
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS privacy_notice_version text;

-- 2. Bank account numbers are stored encrypted by the API (AES-256-GCM, key outside the
--    database). The clear-text columns remain only for rows written before this migration;
--    ops/encrypt-account-numbers.mjs converts them and then forbids clear text.
ALTER TABLE lawyer_payment_details ADD COLUMN IF NOT EXISTS account_number_enc text;
ALTER TABLE lawyer_payment_details ADD COLUMN IF NOT EXISTS account_last4 text;
ALTER TABLE lawyer_payment_details DROP CONSTRAINT IF EXISTS account_last4_digits;
ALTER TABLE lawyer_payment_details ADD CONSTRAINT account_last4_digits CHECK (account_last4 ~ '^[0-9]{4}$');
ALTER TABLE lawyer_payment_details DROP CONSTRAINT IF EXISTS method_fields;
ALTER TABLE lawyer_payment_details ADD CONSTRAINT method_fields CHECK (
  (method='bank_transfer' AND bank_name IS NOT NULL AND payment_url IS NULL
     AND (account_number IS NOT NULL OR account_number_enc IS NOT NULL))
  OR (method='paystack_link' AND payment_url IS NOT NULL AND bank_name IS NULL
     AND account_number IS NULL AND account_number_enc IS NULL)
);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pay_account_number_enc text;

-- 3. A client's contact is removed a set time after the engagement closes.
ALTER TABLE engagements ALTER COLUMN client_contact DROP NOT NULL;
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS client_contact_removed_at timestamptz;
ALTER TABLE engagements DROP CONSTRAINT IF EXISTS contact_present_or_removed;
ALTER TABLE engagements ADD CONSTRAINT contact_present_or_removed
  CHECK (client_contact IS NOT NULL OR client_contact_removed_at IS NOT NULL);

-- 4. Data-subject requests. A person records a request; an operator acts on it.
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS erased_at timestamptz;
CREATE TABLE IF NOT EXISTS data_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('erasure','correction','restriction','objection')),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','in_progress','completed','refused')),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_data_requests_one_open
  ON data_requests (user_id, kind) WHERE status IN ('received','in_progress');

-- 5. Operator-only erasure. Identifying data is removed or replaced; rows that other
--    people rely on (the other party's invoices and receipts, the audit trail) stay,
--    without the erased person's details. Not callable by the API's runtime login.
CREATE OR REPLACE FUNCTION lexflow_erase_user(p_user_id uuid) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_app uuid;
  v_n_eng integer := 0;
  v_n_inv integer := 0;
BEGIN
  PERFORM 1 FROM app_users WHERE id = p_user_id AND erased_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found or already erased'; END IF;
  SELECT id INTO v_app FROM lawyer_applications WHERE user_id = p_user_id;
  IF v_app IS NOT NULL THEN
    UPDATE lawyer_applications SET full_name='[erased]', city='[erased]',
      summary='[erased at the data subject''s request]', published=false,
      status=CASE WHEN status='verified' THEN 'suspended' ELSE status END,
      verification_valid_until=NULL, approved_for_publication_by=NULL,
      updated_at=now(), version=version+1 WHERE id = v_app;
    UPDATE verification_reviews SET
      source_reference=CASE WHEN source_reference IS NULL THEN NULL ELSE '[erased]' END,
      rejection_reason=CASE WHEN rejection_reason IS NULL THEN NULL ELSE '[erased]' END
      WHERE application_id = v_app;
    DELETE FROM payment_detail_reviews WHERE detail_id IN (SELECT id FROM lawyer_payment_details WHERE application_id = v_app);
    DELETE FROM lawyer_payment_details WHERE application_id = v_app;
    UPDATE invoices SET pay_account_name='[erased]', pay_bank_name=NULL, pay_account_number=NULL,
      pay_account_number_enc=NULL, pay_url=NULL, updated_at=now()
      WHERE engagement_id IN (SELECT id FROM engagements WHERE application_id = v_app);
    GET DIAGNOSTICS v_n_inv = ROW_COUNT;
  END IF;
  UPDATE engagements SET client_name='[erased]', client_contact=NULL,
    client_contact_removed_at=COALESCE(client_contact_removed_at, now()), updated_at=now()
    WHERE client_user_id = p_user_id;
  GET DIAGNOSTICS v_n_eng = ROW_COUNT;
  UPDATE app_users SET oidc_subject='erased:' || gen_random_uuid(), is_active=false, erased_at=now()
    WHERE id = p_user_id;
  UPDATE data_requests SET status='completed', closed_at=now()
    WHERE user_id = p_user_id AND kind='erasure' AND status IN ('received','in_progress');
  INSERT INTO audit_events(actor_user_id,target_application_id,action,metadata)
    VALUES (NULL, v_app, 'data_subject_erasure', jsonb_build_object('client_engagements', v_n_eng, 'lawyer_invoices', v_n_inv));
  RETURN format('erased: application=%s, client engagements=%s, lawyer invoices=%s', v_app IS NOT NULL, v_n_eng, v_n_inv);
END $$;
REVOKE ALL ON FUNCTION lexflow_erase_user(uuid) FROM PUBLIC;
COMMIT;
