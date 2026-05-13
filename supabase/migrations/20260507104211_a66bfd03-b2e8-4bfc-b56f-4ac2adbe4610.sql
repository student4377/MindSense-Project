-- Storage bucket for test media (voice + video)
INSERT INTO storage.buckets (id, name, public) VALUES ('test-media', 'test-media', false)
ON CONFLICT (id) DO NOTHING;

-- Users can upload to their own folder
CREATE POLICY "Users upload own test media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'test-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own test media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'test-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own test media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'test-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Table to store depression test submissions
CREATE TABLE public.depression_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  text_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  voice_path text,
  video_path text,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.depression_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own tests" ON public.depression_tests
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own tests" ON public.depression_tests
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users update own tests" ON public.depression_tests
FOR UPDATE TO authenticated USING (auth.uid() = user_id);
