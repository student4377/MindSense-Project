CREATE TABLE IF NOT EXISTS public.model_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.depression_tests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phq_score numeric(5,2) NOT NULL CHECK (phq_score >= 0 AND phq_score <= 24),
  severity text NOT NULL CHECK (severity IN ('minimal', 'mild', 'moderate', 'moderately_severe', 'severe')),
  confidence numeric(6,5) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  prediction_source text NOT NULL CHECK (prediction_source IN ('learned_model', 'questionnaire_baseline')),
  model_version text NOT NULL,
  modality_gates jsonb NOT NULL DEFAULT '{}'::jsonb,
  modality_outputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  explanation text,
  raw_prediction jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.model_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own model predictions" ON public.model_predictions;
DROP POLICY IF EXISTS "Users view own model predictions" ON public.model_predictions;
DROP POLICY IF EXISTS "Admins view model predictions" ON public.model_predictions;

CREATE POLICY "Users insert own model predictions"
  ON public.model_predictions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own model predictions"
  ON public.model_predictions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view model predictions"
  ON public.model_predictions FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS model_predictions_assessment_id_idx ON public.model_predictions (assessment_id);
CREATE INDEX IF NOT EXISTS model_predictions_user_created_idx ON public.model_predictions (user_id, created_at DESC);
