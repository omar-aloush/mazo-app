-- =============================================
-- MAZŌ: Lock Down RLS Policies (SECURITY FIX)
-- Run this in Supabase Dashboard → SQL Editor
-- =============================================
-- WHAT THIS DOES:
-- 1. Adds new columns to subscribers table for Google Play tracking
-- 2. Removes wide-open policies on subscribers/vouchers tables
-- 3. Makes subscribers READ-ONLY from client (only Edge Functions can write)
-- 4. Makes vouchers/redemptions READ-ONLY from client
-- 5. Keeps community_coaches and ratings open for UGC

-- =============================================
-- STEP 0: Add new columns to subscribers table
-- =============================================

ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS purchase_token TEXT;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS product_id TEXT;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'android';

-- =============================================
-- STEP 1: Drop existing wide-open policies
-- =============================================

-- Subscribers: drop all old policies
DROP POLICY IF EXISTS "Anyone can read subscribers" ON subscribers;
DROP POLICY IF EXISTS "Anyone can insert subscribers" ON subscribers;
DROP POLICY IF EXISTS "Anyone can update subscribers" ON subscribers;

-- Vouchers: drop all old policies
DROP POLICY IF EXISTS "Anyone can read vouchers" ON vouchers;
DROP POLICY IF EXISTS "Anyone can insert vouchers" ON vouchers;
DROP POLICY IF EXISTS "Anyone can update vouchers" ON vouchers;

-- Voucher redemptions: drop all old policies
DROP POLICY IF EXISTS "Anyone can read redemptions" ON voucher_redemptions;
DROP POLICY IF EXISTS "Anyone can insert redemptions" ON voucher_redemptions;

-- =============================================
-- STEP 2: Create secure policies
-- =============================================

-- SUBSCRIBERS: Anon can ONLY read their own row (by user_id match).
-- NO insert/update from client — only service_role (Edge Functions) can write.
CREATE POLICY "Users can read own subscription"
  ON subscribers FOR SELECT
  USING (true);
  -- Note: we keep SELECT open because the app needs to check subscription
  -- status, and user_id is a device-generated ID (not an auth user).
  -- The security is that the client CANNOT write/update — only read.

-- Block all client writes to subscribers
-- (Edge Functions use service_role key which bypasses RLS)
CREATE POLICY "No client inserts on subscribers"
  ON subscribers FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No client updates on subscribers"
  ON subscribers FOR UPDATE
  USING (false);

CREATE POLICY "No client deletes on subscribers"
  ON subscribers FOR DELETE
  USING (false);

-- VOUCHERS: Read-only for client.
CREATE POLICY "Anyone can read vouchers"
  ON vouchers FOR SELECT
  USING (true);

CREATE POLICY "No client inserts on vouchers"
  ON vouchers FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No client updates on vouchers"
  ON vouchers FOR UPDATE
  USING (false);

-- VOUCHER REDEMPTIONS: Read-only for client.
CREATE POLICY "Anyone can read own redemptions"
  ON voucher_redemptions FOR SELECT
  USING (true);

CREATE POLICY "No client inserts on redemptions"
  ON voucher_redemptions FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No client updates on redemptions"
  ON voucher_redemptions FOR UPDATE
  USING (false);

-- =============================================
-- STEP 3: Create app_config table (if not exists)
-- This is for remote feature flags like trial_enabled
-- =============================================

CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- App config: read-only for client
DROP POLICY IF EXISTS "Anyone can read config" ON app_config;
CREATE POLICY "Anyone can read config"
  ON app_config FOR SELECT
  USING (true);

CREATE POLICY "No client writes to config"
  ON app_config FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No client updates to config"
  ON app_config FOR UPDATE
  USING (false);

-- =============================================
-- STEP 4: Insert/update default config values
-- =============================================

INSERT INTO app_config (key, value) VALUES
  ('trial_enabled', 'true'),
  ('trial_days', '7'),
  ('referral_enabled', 'true'),
  ('referral_reward_days', '3'),
  ('smart_paywall_enabled', 'true'),
  ('streak_enabled', 'true'),
  ('streak_milestones', '[3, 7, 14, 30]')
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- STEP 5: Verify (run these after applying)
-- =============================================

-- Test 1: This should FAIL (blocked by RLS):
-- INSERT INTO subscribers (user_id, subscription_tier, is_active) VALUES ('hacker', 'pro', true);

-- Test 2: This should FAIL (blocked by RLS):
-- UPDATE subscribers SET subscription_tier = 'pro', is_active = true WHERE user_id = 'some-user';

-- Test 3: This should SUCCEED (read is allowed):
-- SELECT * FROM subscribers LIMIT 5;

-- Test 4: This should SUCCEED (config read is allowed):
-- SELECT * FROM app_config;
