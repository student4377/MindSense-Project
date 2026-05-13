CREATE TABLE public.mood_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mood smallint NOT NULL CHECK (mood BETWEEN 1 AND 5),
  note text,
  tags text[] DEFAULT '{}',
  energy smallint DEFAULT 5,
  sleep_quality smallint DEFAULT 5,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mood_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own mood entries" ON public.mood_entries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own mood entries" ON public.mood_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own mood entries" ON public.mood_entries
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own mood entries" ON public.mood_entries
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_mood_entries_user_date ON public.mood_entries(user_id, entry_date DESC);