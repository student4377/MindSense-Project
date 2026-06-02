CREATE TABLE IF NOT EXISTS public.admin_ai_settings (
  id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  text_weight integer NOT NULL DEFAULT 70 CHECK (text_weight >= 0 AND text_weight <= 100),
  audio_weight integer NOT NULL DEFAULT 15 CHECK (audio_weight >= 0 AND audio_weight <= 100),
  video_weight integer NOT NULL DEFAULT 15 CHECK (video_weight >= 0 AND video_weight <= 100),
  high_risk_threshold integer NOT NULL DEFAULT 30 CHECK (high_risk_threshold >= 0 AND high_risk_threshold <= 100),
  watch_threshold integer NOT NULL DEFAULT 55 CHECK (watch_threshold >= 0 AND watch_threshold <= 100),
  confidence_threshold integer NOT NULL DEFAULT 60 CHECK (confidence_threshold >= 0 AND confidence_threshold <= 100),
  analysis_sensitivity text NOT NULL DEFAULT 'balanced' CHECK (analysis_sensitivity IN ('low', 'balanced', 'high')),
  moderation_enabled boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_ai_settings_weight_sum CHECK (text_weight + audio_weight + video_weight = 100),
  CONSTRAINT admin_ai_settings_threshold_order CHECK (high_risk_threshold < watch_threshold)
);

ALTER TABLE public.admin_ai_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view AI settings" ON public.admin_ai_settings;
DROP POLICY IF EXISTS "Admins insert AI settings" ON public.admin_ai_settings;
DROP POLICY IF EXISTS "Admins update AI settings" ON public.admin_ai_settings;
DROP POLICY IF EXISTS "Admins delete AI settings" ON public.admin_ai_settings;

CREATE POLICY "Admins view AI settings"
  ON public.admin_ai_settings FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins insert AI settings"
  ON public.admin_ai_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins update AI settings"
  ON public.admin_ai_settings FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete AI settings"
  ON public.admin_ai_settings FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

INSERT INTO public.admin_ai_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_ai_settings_to_json(_row public.admin_ai_settings)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'textWeight', _row.text_weight,
    'audioWeight', _row.audio_weight,
    'videoWeight', _row.video_weight,
    'highRiskThreshold', _row.high_risk_threshold,
    'watchThreshold', _row.watch_threshold,
    'confidenceThreshold', _row.confidence_threshold,
    'analysisSensitivity', _row.analysis_sensitivity,
    'moderationEnabled', _row.moderation_enabled,
    'updatedBy', _row.updated_by,
    'updatedAt', _row.updated_at
  );
$$;

CREATE OR REPLACE FUNCTION public.get_admin_ai_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings_row public.admin_ai_settings%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT *
  INTO settings_row
  FROM public.admin_ai_settings
  WHERE id = 'default';

  IF NOT FOUND THEN
    settings_row.id := 'default';
    settings_row.text_weight := 70;
    settings_row.audio_weight := 15;
    settings_row.video_weight := 15;
    settings_row.high_risk_threshold := 30;
    settings_row.watch_threshold := 55;
    settings_row.confidence_threshold := 60;
    settings_row.analysis_sensitivity := 'balanced';
    settings_row.moderation_enabled := true;
    settings_row.updated_by := NULL;
    settings_row.updated_at := now();
  END IF;

  RETURN public.admin_ai_settings_to_json(settings_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_admin_ai_settings(
  _text_weight integer,
  _audio_weight integer,
  _video_weight integer,
  _high_risk_threshold integer,
  _watch_threshold integer,
  _confidence_threshold integer,
  _analysis_sensitivity text DEFAULT 'balanced',
  _moderation_enabled boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.admin_ai_settings%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF _text_weight < 0 OR _text_weight > 100
    OR _audio_weight < 0 OR _audio_weight > 100
    OR _video_weight < 0 OR _video_weight > 100 THEN
    RAISE EXCEPTION 'Fusion weights must be between 0 and 100';
  END IF;

  IF _text_weight + _audio_weight + _video_weight <> 100 THEN
    RAISE EXCEPTION 'Fusion weights must add up to 100';
  END IF;

  IF _high_risk_threshold < 0 OR _high_risk_threshold > 100
    OR _watch_threshold < 0 OR _watch_threshold > 100
    OR _confidence_threshold < 0 OR _confidence_threshold > 100 THEN
    RAISE EXCEPTION 'Thresholds must be between 0 and 100';
  END IF;

  IF _high_risk_threshold >= _watch_threshold THEN
    RAISE EXCEPTION 'High-risk threshold must be lower than watch threshold';
  END IF;

  IF _analysis_sensitivity NOT IN ('low', 'balanced', 'high') THEN
    RAISE EXCEPTION 'Invalid analysis sensitivity';
  END IF;

  INSERT INTO public.admin_ai_settings (
    id,
    text_weight,
    audio_weight,
    video_weight,
    high_risk_threshold,
    watch_threshold,
    confidence_threshold,
    analysis_sensitivity,
    moderation_enabled,
    updated_by,
    updated_at
  )
  VALUES (
    'default',
    _text_weight,
    _audio_weight,
    _video_weight,
    _high_risk_threshold,
    _watch_threshold,
    _confidence_threshold,
    _analysis_sensitivity,
    COALESCE(_moderation_enabled, true),
    auth.uid(),
    now()
  )
  ON CONFLICT (id)
  DO UPDATE SET
    text_weight = EXCLUDED.text_weight,
    audio_weight = EXCLUDED.audio_weight,
    video_weight = EXCLUDED.video_weight,
    high_risk_threshold = EXCLUDED.high_risk_threshold,
    watch_threshold = EXCLUDED.watch_threshold,
    confidence_threshold = EXCLUDED.confidence_threshold,
    analysis_sensitivity = EXCLUDED.analysis_sensitivity,
    moderation_enabled = EXCLUDED.moderation_enabled,
    updated_by = EXCLUDED.updated_by,
    updated_at = now()
  RETURNING * INTO updated_row;

  RETURN public.admin_ai_settings_to_json(updated_row);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_ai_settings_to_json(public.admin_ai_settings) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_ai_settings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_admin_ai_settings(integer, integer, integer, integer, integer, integer, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_ai_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_admin_ai_settings(integer, integer, integer, integer, integer, integer, text, boolean) TO authenticated;
