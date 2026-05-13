ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS mood_category text,
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS estimated_duration text,
  ADD COLUMN IF NOT EXISTS source_platform text,
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

UPDATE public.resources
SET
  external_url = COALESCE(external_url, content_url),
  estimated_duration = COALESCE(estimated_duration, duration),
  mood_category = COALESCE(
    mood_category,
    CASE
      WHEN topic ILIKE '%sleep%' OR topic ILIKE '%rest%' THEN 'sleep_support'
      WHEN topic ILIKE '%anx%' OR topic ILIKE '%panic%' OR topic ILIKE '%worry%' OR topic ILIKE '%overthinking%' THEN 'anxious'
      WHEN topic ILIKE '%stress%' OR topic ILIKE '%pressure%' OR topic ILIKE '%burnout%' THEN 'stressed'
      WHEN topic ILIKE '%overwhelm%' OR topic ILIKE '%low mood%' OR topic ILIKE '%sad%' THEN 'overwhelmed'
      WHEN topic ILIKE '%motivat%' OR topic ILIKE '%tired%' OR topic ILIKE '%fatigue%' THEN 'low_motivation'
      WHEN topic ILIKE '%focus%' OR topic ILIKE '%productiv%' THEN 'focused'
      WHEN topic ILIKE '%calm%' OR topic ILIKE '%relax%' THEN 'calm'
      WHEN topic ILIKE '%mindful%' OR topic ILIKE '%meditat%' THEN 'mindfulness'
      WHEN topic IS NOT NULL THEN 'mindfulness'
      ELSE NULL
    END
  ),
  source_platform = COALESCE(
    source_platform,
    CASE
      WHEN content_url ILIKE '%youtube.com%' OR content_url ILIKE '%youtu.be%' THEN 'youtube'
      WHEN content_url ILIKE '%spotify.com%' THEN 'spotify'
      WHEN content_url ILIKE '%soundcloud.com%' THEN 'soundcloud'
      WHEN content_url IS NOT NULL THEN 'external'
      ELSE NULL
    END
  )
WHERE external_url IS NULL
   OR estimated_duration IS NULL
   OR mood_category IS NULL
   OR source_platform IS NULL;

UPDATE public.resources
SET mood_category = CASE
  WHEN mood_category ILIKE '%sleep%' OR mood_category ILIKE '%rest%' THEN 'sleep_support'
  WHEN mood_category ILIKE '%anx%' OR mood_category ILIKE '%panic%' OR mood_category ILIKE '%worry%' OR mood_category ILIKE '%overthinking%' THEN 'anxious'
  WHEN mood_category ILIKE '%stress%' OR mood_category ILIKE '%pressure%' OR mood_category ILIKE '%burnout%' THEN 'stressed'
  WHEN mood_category ILIKE '%overwhelm%' OR mood_category ILIKE '%low mood%' OR mood_category ILIKE '%sad%' THEN 'overwhelmed'
  WHEN mood_category ILIKE '%motivat%' OR mood_category ILIKE '%tired%' OR mood_category ILIKE '%fatigue%' THEN 'low_motivation'
  WHEN mood_category ILIKE '%focus%' OR mood_category ILIKE '%productiv%' THEN 'focused'
  WHEN mood_category ILIKE '%calm%' OR mood_category ILIKE '%relax%' THEN 'calm'
  WHEN mood_category ILIKE '%mindful%' OR mood_category ILIKE '%meditat%' THEN 'mindfulness'
  ELSE 'mindfulness'
END
WHERE mood_category IS NOT NULL
  AND mood_category NOT IN ('stressed', 'anxious', 'low_motivation', 'overwhelmed', 'calm', 'focused', 'mindfulness', 'sleep_support');

CREATE INDEX IF NOT EXISTS idx_resources_published_created
  ON public.resources(is_published, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_resources_type_mood
  ON public.resources(type, mood_category);

CREATE INDEX IF NOT EXISTS idx_resources_tags
  ON public.resources USING gin(tags);

DROP POLICY IF EXISTS "Authenticated view resources" ON public.resources;
DROP POLICY IF EXISTS "Admins insert resources" ON public.resources;
DROP POLICY IF EXISTS "Admins update resources" ON public.resources;
DROP POLICY IF EXISTS "Admins delete resources" ON public.resources;

CREATE POLICY "Users view published resources"
  ON public.resources FOR SELECT TO authenticated
  USING (is_published = true OR public.is_admin(auth.uid()));

CREATE POLICY "Admins insert resources"
  ON public.resources FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins update resources"
  ON public.resources FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete resources"
  ON public.resources FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));
