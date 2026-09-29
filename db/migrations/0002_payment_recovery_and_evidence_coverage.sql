ALTER TABLE settlements
  ADD COLUMN IF NOT EXISTS pending_action text,
  ADD COLUMN IF NOT EXISTS payment_action_previous_status text;

ALTER TABLE condition_reports
  ADD COLUMN IF NOT EXISTS maximum_observed_gap_seconds numeric,
  ADD COLUMN IF NOT EXISTS coverage_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS evidence_integrity_valid boolean NOT NULL DEFAULT false;
