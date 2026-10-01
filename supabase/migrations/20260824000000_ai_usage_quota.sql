-- Server-only daily AI quota. Clients have no table or function access.
CREATE TABLE IF NOT EXISTS public.ai_usage_daily (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, usage_date)
);

ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_usage_daily FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_ai_daily_quota(
  p_user_id UUID,
  p_daily_limit INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  accepted_user_id UUID;
BEGIN
  IF p_user_id IS NULL OR p_daily_limit < 1 OR p_daily_limit > 1000 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.ai_usage_daily (user_id, usage_date, request_count, updated_at)
  VALUES (p_user_id, CURRENT_DATE, 1, NOW())
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET
    request_count = public.ai_usage_daily.request_count + 1,
    updated_at = NOW()
  WHERE public.ai_usage_daily.request_count < p_daily_limit
  RETURNING user_id INTO accepted_user_id;

  RETURN accepted_user_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_daily_quota(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_daily_quota(UUID, INTEGER) TO service_role;
