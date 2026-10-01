ALTER TABLE public.vouchers
  ADD CONSTRAINT vouchers_duration_days_valid CHECK (duration_days BETWEEN 1 AND 3650) NOT VALID,
  ADD CONSTRAINT vouchers_usage_counts_valid CHECK (
    max_uses >= 0 AND current_uses >= 0 AND current_uses <= max_uses
  ) NOT VALID;

UPDATE public.vouchers
SET duration_days = least(greatest(duration_days, 1), 3650),
    max_uses = greatest(max_uses, 0),
    current_uses = least(greatest(current_uses, 0), greatest(max_uses, 0));

ALTER TABLE public.vouchers VALIDATE CONSTRAINT vouchers_duration_days_valid;
ALTER TABLE public.vouchers VALIDATE CONSTRAINT vouchers_usage_counts_valid;

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('vouchers', 'voucher_redemptions')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_record.policyname, policy_record.tablename);
  END LOOP;
END
$$;

REVOKE ALL ON TABLE public.vouchers FROM anon, authenticated;
REVOKE ALL ON TABLE public.voucher_redemptions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.redeem_voucher_for_owner(p_owner_id UUID, p_code TEXT)
RETURNS TABLE(result_code TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  voucher_record public.vouchers%ROWTYPE;
  subscriber_record public.subscribers%ROWTYPE;
  normalized_code TEXT := upper(trim(p_code));
  granted_until TIMESTAMPTZ;
  final_expiry TIMESTAMPTZ;
BEGIN
  SELECT * INTO voucher_record
  FROM public.vouchers
  WHERE code = normalized_code AND is_active = true
  FOR UPDATE;

  IF NOT FOUND OR (voucher_record.expires_at IS NOT NULL AND voucher_record.expires_at <= now()) THEN
    RETURN QUERY SELECT 'invalid'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;
  IF voucher_record.current_uses >= voucher_record.max_uses THEN
    RETURN QUERY SELECT 'exhausted'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.voucher_redemptions
    WHERE voucher_id = voucher_record.id AND user_id = p_owner_id::TEXT
  ) THEN
    RETURN QUERY SELECT 'already_redeemed'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT * INTO subscriber_record
  FROM public.subscribers
  WHERE owner_id = p_owner_id
  FOR UPDATE;

  IF FOUND AND subscriber_record.is_active
    AND subscriber_record.subscription_tier = 'pro'
    AND subscriber_record.expires_at IS NULL
  THEN
    RETURN QUERY SELECT 'already_entitled'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  granted_until := now() + make_interval(days => voucher_record.duration_days);
  final_expiry := greatest(coalesce(subscriber_record.expires_at, now()), granted_until);

  INSERT INTO public.voucher_redemptions (
    voucher_id, user_id, redeemed_at, subscription_granted_until
  ) VALUES (
    voucher_record.id, p_owner_id::TEXT, now(), final_expiry
  );

  UPDATE public.vouchers SET current_uses = current_uses + 1 WHERE id = voucher_record.id;

  INSERT INTO public.subscribers (
    owner_id, user_id, subscription_tier, subscription_source, is_active,
    expires_at, voucher_code, started_at, updated_at
  ) VALUES (
    p_owner_id, p_owner_id::TEXT, 'pro', 'voucher', true,
    final_expiry, normalized_code, now(), now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET owner_id = EXCLUDED.owner_id,
      subscription_tier = 'pro',
      subscription_source = CASE
        WHEN public.subscribers.is_active
          AND public.subscribers.subscription_tier = 'pro'
          AND public.subscribers.expires_at >= EXCLUDED.expires_at
        THEN public.subscribers.subscription_source
        ELSE 'voucher'
      END,
      is_active = true,
      expires_at = greatest(public.subscribers.expires_at, EXCLUDED.expires_at),
      voucher_code = EXCLUDED.voucher_code,
      updated_at = now();

  RETURN QUERY SELECT 'success'::TEXT, final_expiry;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_voucher_for_owner(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_voucher_for_owner(UUID, TEXT) TO service_role;
