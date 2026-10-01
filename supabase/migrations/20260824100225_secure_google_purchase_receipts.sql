CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS private.purchase_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform = 'android'),
  package_name TEXT NOT NULL CHECK (length(package_name) BETWEEN 1 AND 255),
  purchase_token_hash BYTEA NOT NULL,
  product_id TEXT NOT NULL CHECK (length(product_id) BETWEEN 1 AND 255),
  order_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  google_state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS purchase_receipts_token_hash_key
  ON private.purchase_receipts(purchase_token_hash);
CREATE INDEX IF NOT EXISTS purchase_receipts_owner_id_idx
  ON private.purchase_receipts(owner_id);

ALTER TABLE private.purchase_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.purchase_receipts FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.record_google_purchase(
  p_owner_id UUID,
  p_platform TEXT,
  p_package_name TEXT,
  p_purchase_token TEXT,
  p_product_id TEXT,
  p_order_id TEXT,
  p_expires_at TIMESTAMPTZ,
  p_google_state TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  token_hash BYTEA;
  receipt_record private.purchase_receipts%ROWTYPE;
  subscriber_expiry TIMESTAMPTZ;
BEGIN
  IF p_owner_id IS NULL
    OR p_purchase_token IS NULL
    OR length(p_purchase_token) NOT BETWEEN 1 AND 4096
    OR p_product_id IS NULL
    OR p_expires_at IS NULL
    OR p_expires_at <= clock_timestamp()
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_purchase_request';
  END IF;
  IF p_platform <> 'android' OR p_package_name <> 'app.mazo.ai' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_purchase_application';
  END IF;
  IF p_google_state NOT IN (
    'SUBSCRIPTION_STATE_ACTIVE',
    'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
    'SUBSCRIPTION_STATE_CANCELED'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'subscription_not_active';
  END IF;

  token_hash := extensions.digest(pg_catalog.convert_to(p_purchase_token, 'UTF8'), 'sha256');

  INSERT INTO private.purchase_receipts (
    owner_id, platform, package_name, purchase_token_hash, product_id,
    order_id, expires_at, google_state
  ) VALUES (
    p_owner_id, p_platform, p_package_name, token_hash, p_product_id,
    p_order_id, p_expires_at, p_google_state
  ) ON CONFLICT (purchase_token_hash) DO NOTHING;

  SELECT * INTO receipt_record
  FROM private.purchase_receipts
  WHERE purchase_token_hash = token_hash
  FOR UPDATE;

  IF receipt_record.owner_id <> p_owner_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'purchase_token_bound_to_other_owner';
  END IF;
  IF receipt_record.platform <> p_platform
    OR receipt_record.package_name <> p_package_name
    OR receipt_record.product_id <> p_product_id
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'purchase_receipt_mismatch';
  END IF;

  UPDATE private.purchase_receipts
  SET expires_at = greatest(receipt_record.expires_at, p_expires_at),
      order_id = coalesce(p_order_id, order_id),
      google_state = p_google_state,
      updated_at = clock_timestamp()
  WHERE id = receipt_record.id;

  UPDATE public.subscribers AS subscriber
  SET subscription_tier = 'pro',
      subscription_source = CASE
        WHEN subscriber.is_active AND subscriber.subscription_tier = 'pro' AND subscriber.expires_at IS NULL
        THEN subscriber.subscription_source
        ELSE 'google_play'
      END,
      is_active = true,
      expires_at = CASE
        WHEN subscriber.is_active AND subscriber.subscription_tier = 'pro' AND subscriber.expires_at IS NULL
        THEN NULL
        ELSE greatest(coalesce(subscriber.expires_at, p_expires_at), p_expires_at)
      END,
      cancelled_at = NULL,
      product_id = p_product_id,
      order_id = coalesce(p_order_id, subscriber.order_id),
      platform = p_platform,
      purchase_token = NULL,
      updated_at = clock_timestamp()
  WHERE subscriber.owner_id = p_owner_id
  RETURNING subscriber.expires_at INTO subscriber_expiry;

  IF NOT FOUND THEN
    INSERT INTO public.subscribers AS subscriber (
      user_id, owner_id, subscription_tier, subscription_source, is_active,
      started_at, expires_at, product_id, order_id, platform, purchase_token
    ) VALUES (
      p_owner_id::TEXT, p_owner_id, 'pro', 'google_play', true,
      clock_timestamp(), p_expires_at, p_product_id, p_order_id, p_platform, NULL
    )
    ON CONFLICT (user_id) DO UPDATE
    SET owner_id = EXCLUDED.owner_id,
        subscription_tier = 'pro',
        subscription_source = CASE
          WHEN subscriber.is_active AND subscriber.subscription_tier = 'pro' AND subscriber.expires_at IS NULL
          THEN subscriber.subscription_source
          ELSE 'google_play'
        END,
        is_active = true,
        expires_at = CASE
          WHEN subscriber.is_active AND subscriber.subscription_tier = 'pro' AND subscriber.expires_at IS NULL
          THEN NULL
          ELSE greatest(coalesce(subscriber.expires_at, EXCLUDED.expires_at), EXCLUDED.expires_at)
        END,
        cancelled_at = NULL,
        product_id = EXCLUDED.product_id,
        order_id = coalesce(EXCLUDED.order_id, subscriber.order_id),
        platform = EXCLUDED.platform,
        purchase_token = NULL,
        updated_at = clock_timestamp()
    WHERE subscriber.owner_id IS NULL OR subscriber.owner_id = EXCLUDED.owner_id
    RETURNING subscriber.expires_at INTO subscriber_expiry;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0003', MESSAGE = 'subscriber_owner_conflict';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'isPro', true,
    'expiresAt', coalesce(subscriber_expiry, p_expires_at),
    'source', 'google_play',
    'orderId', coalesce(p_order_id, receipt_record.order_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_google_purchase(
  p_owner_id UUID,
  p_platform TEXT,
  p_package_name TEXT,
  p_purchase_token TEXT,
  p_product_id TEXT,
  p_order_id TEXT,
  p_expires_at TIMESTAMPTZ,
  p_google_state TEXT
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.record_google_purchase(
    p_owner_id, p_platform, p_package_name, p_purchase_token,
    p_product_id, p_order_id, p_expires_at, p_google_state
  );
$$;

REVOKE ALL ON FUNCTION private.record_google_purchase(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.record_google_purchase(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_google_purchase(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT)
  TO service_role;
