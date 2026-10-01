-- Bind subscription records to verified Supabase Auth users. The legacy
-- user_id remains temporarily for compatibility with the purchase/voucher
-- functions while those endpoints are migrated separately.
ALTER TABLE public.subscribers
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Safely adopt only legacy rows whose user_id is already an actual auth UUID.
UPDATE public.subscribers AS subscriber
SET owner_id = auth_user.id
FROM auth.users AS auth_user
WHERE subscriber.owner_id IS NULL
  AND subscriber.user_id = auth_user.id::TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS subscribers_owner_id_key
  ON public.subscribers(owner_id)
  WHERE owner_id IS NOT NULL;

ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

-- Replace every historical subscriber policy, including permissive policies
-- created under older names.
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscribers'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.subscribers', policy_record.policyname);
  END LOOP;
END
$$;

CREATE POLICY subscribers_select_own
  ON public.subscribers
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = owner_id);

-- RLS and grants are separate controls. Expose only entitlement fields to the
-- app; billing identifiers, device IDs, and other users' rows remain private.
REVOKE ALL ON TABLE public.subscribers FROM anon, authenticated;
GRANT SELECT (
  subscription_tier,
  subscription_source,
  is_active,
  started_at,
  expires_at,
  cancelled_at,
  updated_at
) ON TABLE public.subscribers TO authenticated;

-- Serialize first registration by both owner and device so concurrent app
-- starts cannot create duplicate subscribers or grant multiple device trials.
CREATE OR REPLACE FUNCTION public.register_subscriber_device(
  p_owner_id UUID,
  p_device_id TEXT,
  p_platform TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  subscriber_record public.subscribers%ROWTYPE;
  trial_enabled BOOLEAN := false;
  trial_days INTEGER := 7;
  grant_trial BOOLEAN := false;
  trial_expiry TIMESTAMPTZ;
  created_new BOOLEAN := false;
BEGIN
  IF p_owner_id IS NULL
    OR p_device_id !~ '^dev_[a-z0-9_]{8,80}$'
    OR p_platform NOT IN ('android', 'ios', 'web')
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_registration_request';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner_id::TEXT, 0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_device_id, 1));

  SELECT * INTO subscriber_record
  FROM public.subscribers
  WHERE owner_id = p_owner_id
  FOR UPDATE;

  IF FOUND THEN
    IF subscriber_record.expires_at IS NOT NULL AND subscriber_record.expires_at <= now() THEN
      UPDATE public.subscribers
      SET is_active = false,
          subscription_tier = 'free',
          updated_at = now()
      WHERE owner_id = p_owner_id
      RETURNING * INTO subscriber_record;
    END IF;

    RETURN jsonb_build_object(
      'isNew', false,
      'isPro', subscriber_record.is_active
        AND subscriber_record.subscription_tier = 'pro'
        AND (subscriber_record.expires_at IS NULL OR subscriber_record.expires_at > now()),
      'tier', CASE
        WHEN subscriber_record.is_active
          AND subscriber_record.subscription_tier = 'pro'
          AND (subscriber_record.expires_at IS NULL OR subscriber_record.expires_at > now())
        THEN 'pro' ELSE 'free' END,
      'source', subscriber_record.subscription_source,
      'expiresAt', subscriber_record.expires_at
    );
  END IF;

  -- Legacy paid/trial rows cannot be safely claimed from a client-controlled
  -- device ID. Stop instead of silently replacing the entitlement.
  IF EXISTS (
    SELECT 1 FROM public.subscribers
    WHERE device_id = p_device_id
      AND owner_id IS NULL
      AND (subscription_source IS NOT NULL OR subscription_tier = 'pro')
  ) THEN
    RETURN jsonb_build_object('resultCode', 'legacy_migration_required');
  END IF;

  SELECT coalesce(value = 'true'::JSONB, false)
  INTO trial_enabled
  FROM public.app_config
  WHERE key = 'trial_enabled';

  SELECT greatest(1, least(365, coalesce((value #>> '{}')::INTEGER, 7)))
  INTO trial_days
  FROM public.app_config
  WHERE key = 'trial_days';
  trial_days := coalesce(trial_days, 7);

  grant_trial := coalesce(trial_enabled, false) AND NOT EXISTS (
    SELECT 1 FROM public.subscribers
    WHERE device_id = p_device_id AND subscription_source IS NOT NULL
  );
  IF grant_trial THEN
    trial_expiry := now() + make_interval(days => trial_days);
  END IF;

  INSERT INTO public.subscribers (
    owner_id, user_id, device_id, subscription_tier, subscription_source,
    is_active, started_at, expires_at, updated_at, platform
  ) VALUES (
    p_owner_id, p_owner_id::TEXT, p_device_id,
    CASE WHEN grant_trial THEN 'pro' ELSE 'free' END,
    CASE WHEN grant_trial THEN 'trial' ELSE NULL END,
    true, now(), trial_expiry, now(), p_platform
  )
  ON CONFLICT (user_id) DO NOTHING
  RETURNING * INTO subscriber_record;

  created_new := FOUND;

  IF NOT created_new THEN
    SELECT * INTO subscriber_record
    FROM public.subscribers
    WHERE owner_id = p_owner_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'subscriber_owner_conflict';
  END IF;

  RETURN jsonb_build_object(
    'isNew', created_new,
    'isPro', subscriber_record.is_active
      AND subscriber_record.subscription_tier = 'pro'
      AND (subscriber_record.expires_at IS NULL OR subscriber_record.expires_at > now()),
    'tier', CASE
      WHEN subscriber_record.is_active
        AND subscriber_record.subscription_tier = 'pro'
        AND (subscriber_record.expires_at IS NULL OR subscriber_record.expires_at > now())
      THEN 'pro' ELSE 'free' END,
    'source', subscriber_record.subscription_source,
    'expiresAt', subscriber_record.expires_at,
    'trialDays', CASE WHEN created_new AND grant_trial THEN trial_days ELSE 0 END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_subscriber_device(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_subscriber_device(UUID, TEXT, TEXT)
  TO service_role;
