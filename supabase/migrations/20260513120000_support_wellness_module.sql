CREATE TABLE public.support_activity_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (
    activity_type IN ('breathing', 'meditation', 'audio', 'sleep', 'routine', 'recommendation')
  ),
  title text NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.meditation_streaks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  streak_count integer NOT NULL DEFAULT 0 CHECK (streak_count >= 0),
  completed_sessions integer NOT NULL DEFAULT 0 CHECK (completed_sessions >= 0),
  last_completed_at timestamp with time zone,
  last_completed_date date,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.support_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  activities text[] NOT NULL DEFAULT '{}'::text[],
  preferred_time text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.support_recommendation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendation_type text NOT NULL,
  title text NOT NULL,
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.support_activity_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meditation_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_recommendation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own support activity"
  ON public.support_activity_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own support activity"
  ON public.support_activity_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own support activity"
  ON public.support_activity_history FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own support activity"
  ON public.support_activity_history FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users view own meditation streak"
  ON public.meditation_streaks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own meditation streak"
  ON public.meditation_streaks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own meditation streak"
  ON public.meditation_streaks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users view own support routines"
  ON public.support_routines FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own support routines"
  ON public.support_routines FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own support routines"
  ON public.support_routines FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own support routines"
  ON public.support_routines FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users view own recommendation events"
  ON public.support_recommendation_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own recommendation events"
  ON public.support_recommendation_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_support_activity_user_completed
  ON public.support_activity_history(user_id, completed_at DESC);

CREATE INDEX idx_support_routines_user_active
  ON public.support_routines(user_id, active, created_at DESC);

CREATE INDEX idx_support_recommendation_events_user_created
  ON public.support_recommendation_events(user_id, created_at DESC);
