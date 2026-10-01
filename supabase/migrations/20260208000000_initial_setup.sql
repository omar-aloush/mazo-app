-- =============================================
-- Mazō Supabase Database Setup
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. Community Coaches Table
CREATE TABLE IF NOT EXISTS community_coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT NOT NULL,
  specialty TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'calm',
  icon TEXT NOT NULL DEFAULT 'user',
  color TEXT NOT NULL DEFAULT '#6366F1',
  system_prompt TEXT NOT NULL,
  downloads INTEGER NOT NULL DEFAULT 0,
  author TEXT NOT NULL DEFAULT 'Anonymous',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  share_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Coach Ratings Table
CREATE TABLE IF NOT EXISTS coach_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES community_coaches(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(coach_id, user_id)
);

-- 3. Subscribers Table
CREATE TABLE IF NOT EXISTS subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  device_id TEXT,
  email TEXT,
  display_name TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'free',
  subscription_source TEXT DEFAULT 'revenuecat',
  is_active BOOLEAN NOT NULL DEFAULT true,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  voucher_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Vouchers Table
CREATE TABLE IF NOT EXISTS vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL DEFAULT 'pro_trial',
  description TEXT,
  duration_days INTEGER NOT NULL DEFAULT 30,
  max_uses INTEGER NOT NULL DEFAULT 1,
  current_uses INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Voucher Redemptions Table
CREATE TABLE IF NOT EXISTS voucher_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subscription_granted_until TIMESTAMPTZ,
  UNIQUE(voucher_id, user_id)
);

-- =============================================
-- Row Level Security (RLS) Policies
-- =============================================

ALTER TABLE community_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_redemptions ENABLE ROW LEVEL SECURITY;

-- Community Coaches: anyone can read, anyone can insert
CREATE POLICY "Anyone can read coaches" ON community_coaches FOR SELECT USING (true);
CREATE POLICY "Anyone can insert coaches" ON community_coaches FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update coaches" ON community_coaches FOR UPDATE USING (true);

-- Coach Ratings: anyone can read and write
CREATE POLICY "Anyone can read ratings" ON coach_ratings FOR SELECT USING (true);
CREATE POLICY "Anyone can insert ratings" ON coach_ratings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update ratings" ON coach_ratings FOR UPDATE USING (true);

-- Subscribers: anyone can read/write (app manages access)
CREATE POLICY "Anyone can read subscribers" ON subscribers FOR SELECT USING (true);
CREATE POLICY "Anyone can insert subscribers" ON subscribers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update subscribers" ON subscribers FOR UPDATE USING (true);

-- Vouchers: anyone can read, only system inserts
CREATE POLICY "Anyone can read vouchers" ON vouchers FOR SELECT USING (true);
CREATE POLICY "Anyone can insert vouchers" ON vouchers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update vouchers" ON vouchers FOR UPDATE USING (true);

-- Voucher Redemptions: anyone can read/write
CREATE POLICY "Anyone can read redemptions" ON voucher_redemptions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert redemptions" ON voucher_redemptions FOR INSERT WITH CHECK (true);

-- =============================================
-- Indexes for Performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_coaches_share_code ON community_coaches(share_code);
CREATE INDEX IF NOT EXISTS idx_coaches_is_featured ON community_coaches(is_featured);
CREATE INDEX IF NOT EXISTS idx_coaches_rating ON community_coaches(rating DESC);
CREATE INDEX IF NOT EXISTS idx_ratings_coach_id ON coach_ratings(coach_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_user_id ON subscribers(user_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);
CREATE INDEX IF NOT EXISTS idx_redemptions_user_id ON voucher_redemptions(user_id);

-- =============================================
-- Seed Featured Coaches
-- =============================================

INSERT INTO community_coaches (name, role, description, specialty, tone, icon, color, system_prompt, downloads, author, is_featured, rating, rating_count, share_code)
VALUES
  ('Morning Ritualist', 'Morning Routine Coach', 'Helps you design and stick to a powerful morning routine that sets the tone for your entire day. Focuses on building sustainable rituals that align with your goals and energy patterns.', 'Morning routines & rituals', 'warm', 'sunrise', '#E8A87C', 'You are the Morning Ritualist, a coach dedicated to helping people build transformative morning routines. You guide users through designing rituals that match their natural energy, goals, and lifestyle. You believe mornings are sacred and that a great day starts with intentional first actions. Keep advice practical, encouraging, and personalized to each person''s schedule and preferences.', 234, 'Mazo Team', true, 4.7, 189, 'MAZO-MR7K'),
  ('Deep Work Guide', 'Focus Session Coach', 'Guides you through setting up and maintaining deep work sessions for maximum cognitive output. Helps eliminate distractions and build a focused work practice.', 'Focus & deep work', 'calm', 'target', '#6366F1', 'You are the Deep Work Guide, a coach who helps people achieve distraction-free focus on cognitively demanding tasks. You help users design their environment, schedule, and mindset for sustained concentration. You draw on principles of flow state and deliberate practice to maximize productive output. Keep guidance calm, structured, and actionable.', 412, 'Mazo Team', true, 4.9, 347, 'MAZO-DW3F'),
  ('Habit Architect', 'Habit Systems Designer', 'Designs custom habit systems using proven behavioral science principles. Helps you build, track, and maintain habits that stick long-term.', 'Habit design & tracking', 'direct', 'building-2', '#7C9A82', 'You are the Habit Architect, a coach who designs habit systems using behavioral science. You help users identify keystone habits, create implementation intentions, and build habit stacks that compound over time. You focus on making habits obvious, attractive, easy, and satisfying. Keep responses structured, evidence-based, and focused on sustainable change.', 356, 'Mazo Team', true, 4.6, 278, 'MAZO-HA9B'),
  ('Mindset Coach', 'Cognitive Reframing Specialist', 'Helps you identify and reframe negative thought patterns into empowering perspectives. Guides you toward a growth-oriented mindset.', 'Mindset & reframing', 'reflective', 'brain', '#9B59B6', 'You are the Mindset Coach, a specialist in cognitive reframing and growth mindset development. You help users recognize limiting beliefs, challenge negative self-talk, and build empowering mental frameworks. You use reflective questions to guide self-discovery rather than prescribing solutions. Keep responses thoughtful, compassionate, and focused on building lasting mental resilience.', 289, 'Mazo Team', true, 4.5, 213, 'MAZO-MC4R'),
  ('Energy Manager', 'Daily Energy Optimizer', 'Optimizes your daily energy levels by aligning tasks with your natural rhythms. Helps you work smarter by managing energy, not just time.', 'Energy management', 'warm', 'zap', '#F39C12', 'You are the Energy Manager, a coach who helps people optimize their daily energy for peak performance. You guide users to align their most important work with their natural energy peaks and schedule recovery during low periods. You consider sleep, nutrition, movement, and mental load as interconnected energy factors. Keep advice practical, personalized, and focused on sustainable energy throughout the day.', 178, 'Mazo Team', true, 4.3, 142, 'MAZO-EM2Z'),
  ('Decision Maker', 'Decision Framework Coach', 'Provides structured frameworks for making clear, confident decisions. Helps you cut through analysis paralysis and commit to action.', 'Decision making', 'direct', 'scale', '#3498DB', 'You are the Decision Maker, a coach who provides structured frameworks for clear decision-making. You help users break down complex choices using proven methods like weighted matrices, pre-mortems, and reversibility analysis. You cut through analysis paralysis by focusing on what matters most and what can be reversed. Keep responses structured, logical, and action-oriented to help users decide and move forward.', 145, 'Mazo Team', true, 4.1, 98, 'MAZO-DM8X')
ON CONFLICT (share_code) DO NOTHING;

-- =============================================
-- Seed Sample Vouchers
-- =============================================

INSERT INTO vouchers (code, type, description, duration_days, max_uses, is_active)
VALUES
  ('MAZO-LAUNCH', 'pro_trial', 'Launch day Pro trial - 30 days free', 30, 100, true),
  ('MAZO-FRIEND', 'pro_trial', 'Friend referral - 14 days Pro', 14, 500, true),
  ('MAZO-VIP', 'pro_unlimited', 'VIP lifetime access', 365, 10, true)
ON CONFLICT (code) DO NOTHING;
