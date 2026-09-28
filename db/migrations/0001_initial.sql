DO $$
DECLARE has_legacy_snapshot boolean := false;
BEGIN
  IF to_regclass('public.nischit_engine_state') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.nischit_engine_state WHERE id = ''singleton'')'
      INTO has_legacy_snapshot;
    IF has_legacy_snapshot THEN
      RAISE EXCEPTION 'Legacy singleton state must be converted to normalized rows before applying this migration';
    END IF;
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenants (
  id text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  roles text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS display_name text;
UPDATE memberships SET display_name = user_id WHERE display_name IS NULL;
DO $$ BEGIN
  ALTER TABLE memberships ALTER COLUMN display_name SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenants(id),
  actor_id text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenants(id),
  topic text NOT NULL,
  payload jsonb NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nischit_engine_state (
  id text PRIMARY KEY,
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS memberships_tenant_isolation ON memberships;
CREATE POLICY memberships_tenant_isolation ON memberships
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
DROP POLICY IF EXISTS audit_events_tenant_isolation ON audit_events;
CREATE POLICY audit_events_tenant_isolation ON audit_events
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
DROP POLICY IF EXISTS outbox_events_tenant_isolation ON outbox_events;
CREATE POLICY outbox_events_tenant_isolation ON outbox_events
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS outbox_events_ready_idx
  ON outbox_events (available_at, created_at)
  WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS audit_events_tenant_created_idx
  ON audit_events (tenant_id, created_at DESC);

-- Normalized relational aggregates. The legacy singleton snapshot remains only as a
-- compatibility fallback for databases created before this migration was
-- introduced; new writes and reads use these tables.
CREATE TABLE IF NOT EXISTS collaboration_grants (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  granting_tenant_id text NOT NULL REFERENCES tenants(id),
  receiving_tenant_id text NOT NULL REFERENCES tenants(id),
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  actions text[] NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL
);
ALTER TABLE collaboration_grants ADD COLUMN IF NOT EXISTS tenant_id text;
UPDATE collaboration_grants SET tenant_id = granting_tenant_id WHERE tenant_id IS NULL;
DO $$ BEGIN
  ALTER TABLE collaboration_grants ALTER COLUMN tenant_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  manufacturer text NOT NULL,
  base_unit text NOT NULL,
  storage_min_celsius numeric NOT NULL,
  storage_max_celsius numeric NOT NULL,
  minimum_shelf_life_days integer NOT NULL,
  required_documents text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  supplier_tenant_id text NOT NULL REFERENCES tenants(id),
  product_id text NOT NULL REFERENCES products(id),
  quantity integer NOT NULL,
  unit text NOT NULL,
  amount_base_units numeric(78, 0) NOT NULL,
  token text NOT NULL,
  settlement_reference text NOT NULL UNIQUE,
  policy jsonb NOT NULL,
  terms_hash text NOT NULL,
  terms_nonce text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  acknowledged_at timestamptz
);

CREATE TABLE IF NOT EXISTS lots (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  product_id text NOT NULL REFERENCES products(id),
  manufacturer_lot_number text NOT NULL,
  expiry_date date NOT NULL,
  quantity integer NOT NULL,
  unit text NOT NULL
);

CREATE TABLE IF NOT EXISTS shipments (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  supplier_tenant_id text NOT NULL REFERENCES tenants(id),
  purchase_order_id text NOT NULL REFERENCES purchase_orders(id),
  lot_id text NOT NULL REFERENCES lots(id),
  quantity integer NOT NULL,
  dispatched_at timestamptz NOT NULL,
  status text NOT NULL
);

CREATE TABLE IF NOT EXISTS condition_reports (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  shipment_id text NOT NULL REFERENCES shipments(id),
  status text NOT NULL,
  reading_count integer NOT NULL,
  first_reading_at timestamptz,
  last_reading_at timestamptz,
  minimum_temperature_celsius numeric,
  maximum_temperature_celsius numeric,
  average_temperature_celsius numeric,
  excursion_count integer NOT NULL,
  longest_excursion_seconds numeric NOT NULL,
  missing_sequence_count integer NOT NULL,
  signature_coverage numeric NOT NULL,
  hash_chain_valid boolean NOT NULL,
  documents jsonb NOT NULL,
  readings_hash text NOT NULL,
  telemetry_merkle_root text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS goods_receipts (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  purchase_order_id text NOT NULL REFERENCES purchase_orders(id),
  shipment_id text NOT NULL REFERENCES shipments(id),
  site_id text NOT NULL,
  received_quantity integer NOT NULL,
  accepted_quantity integer,
  rejected_quantity integer,
  status text NOT NULL,
  received_at timestamptz NOT NULL,
  received_by text NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_events (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  lot_id text NOT NULL REFERENCES lots(id),
  site_id text NOT NULL,
  kind text NOT NULL,
  quantity integer NOT NULL,
  unit text NOT NULL,
  source_id text NOT NULL,
  reason text,
  reason_code text,
  created_at timestamptz NOT NULL,
  created_by text NOT NULL,
  UNIQUE (tenant_id, source_id)
);
ALTER TABLE inventory_events ADD COLUMN IF NOT EXISTS reason_code text;

CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id text PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  timezone text NOT NULL,
  sites jsonb NOT NULL DEFAULT '[]'::jsonb,
  usage_reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_holdings (
  tenant_id text NOT NULL REFERENCES tenants(id),
  lot_id text NOT NULL REFERENCES lots(id),
  site_id text NOT NULL,
  unit text NOT NULL,
  on_hand integer NOT NULL,
  quarantined integer NOT NULL,
  usable integer NOT NULL,
  PRIMARY KEY (tenant_id, lot_id, site_id, unit)
);

CREATE TABLE IF NOT EXISTS qa_decisions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  receipt_id text NOT NULL REFERENCES goods_receipts(id),
  status text NOT NULL,
  reason text NOT NULL,
  adjustment_bps integer NOT NULL,
  evidence_hash text NOT NULL,
  decided_by text NOT NULL,
  decided_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS settlements (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  purchase_order_id text NOT NULL REFERENCES purchase_orders(id),
  amount_base_units numeric(78, 0) NOT NULL,
  adjustment_bps integer NOT NULL,
  supplier_amount_base_units numeric(78, 0),
  buyer_credit_base_units numeric(78, 0),
  status text NOT NULL,
  payment_reference text,
  confirmed_at timestamptz
);

CREATE TABLE IF NOT EXISTS recalls (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  lot_id text NOT NULL REFERENCES lots(id),
  reason text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  created_by text NOT NULL
);

CREATE TABLE IF NOT EXISTS nischit_idempotency (
  idempotency_key text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  result jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS verification_signatures (
  purchase_order_id text PRIMARY KEY REFERENCES purchase_orders(id),
  tenant_id text NOT NULL REFERENCES tenants(id),
  signature text NOT NULL
);
ALTER TABLE verification_signatures ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES tenants(id);
UPDATE verification_signatures AS signatures
SET tenant_id = purchase_orders.tenant_id
FROM purchase_orders
WHERE signatures.purchase_order_id = purchase_orders.id AND signatures.tenant_id IS NULL;
ALTER TABLE verification_signatures ALTER COLUMN tenant_id SET NOT NULL;

CREATE TABLE IF NOT EXISTS nischit_persistence_meta (
  id text PRIMARY KEY,
  schema_version integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchase_orders_tenant_created_idx ON purchase_orders (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shipments_purchase_order_idx ON shipments (purchase_order_id);
CREATE INDEX IF NOT EXISTS condition_reports_shipment_created_idx ON condition_reports (shipment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_events_tenant_lot_site_idx ON inventory_events (tenant_id, lot_id, site_id, created_at);

INSERT INTO nischit_persistence_meta (id, schema_version, updated_at)
VALUES ('normalized-v1', 1, now())
ON CONFLICT (id) DO UPDATE SET schema_version = EXCLUDED.schema_version, updated_at = EXCLUDED.updated_at;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'collaboration_grants', 'products', 'purchase_orders', 'lots', 'shipments',
    'condition_reports', 'goods_receipts', 'inventory_events', 'inventory_holdings',
    'qa_decisions', 'settlements', 'recalls', 'nischit_idempotency', 'tenant_settings', 'verification_signatures'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_isolation ON %I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I_tenant_isolation ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))',
      table_name, table_name
    );
  END LOOP;
END $$;

-- Production provisions this non-owner login before running migrations. Local
-- development may omit it and use its isolated superuser database role.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nischit_app') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public TO nischit_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nischit_app';
    EXECUTE 'REVOKE ALL ON nischit_engine_state FROM nischit_app';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nischit_app';
  END IF;
END $$;
