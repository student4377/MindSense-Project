CREATE TABLE IF NOT EXISTS public.admin_risk_alert_reviews (
  assessment_id uuid PRIMARY KEY REFERENCES public.depression_tests(id) ON DELETE CASCADE,
  alert_status text NOT NULL DEFAULT 'open' CHECK (alert_status IN ('open', 'acknowledged', 'resolved')),
  priority text NOT NULL DEFAULT 'high' CHECK (priority IN ('watch', 'high', 'urgent')),
  admin_note text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_risk_alert_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view risk alert reviews" ON public.admin_risk_alert_reviews;
DROP POLICY IF EXISTS "Admins insert risk alert reviews" ON public.admin_risk_alert_reviews;
DROP POLICY IF EXISTS "Admins update risk alert reviews" ON public.admin_risk_alert_reviews;
DROP POLICY IF EXISTS "Admins delete risk alert reviews" ON public.admin_risk_alert_reviews;

CREATE POLICY "Admins view risk alert reviews"
  ON public.admin_risk_alert_reviews FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins insert risk alert reviews"
  ON public.admin_risk_alert_reviews FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins update risk alert reviews"
  ON public.admin_risk_alert_reviews FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete risk alert reviews"
  ON public.admin_risk_alert_reviews FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_admin_assessment_analytics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  WITH assessment_base AS (
    SELECT
      dt.id AS assessment_id,
      dt.user_id,
      dt.created_at,
      dt.status,
      public.admin_assessment_wellness_score(dt.text_answers) AS wellness_score,
      jsonb_array_length(COALESCE(dt.text_answers, '[]'::jsonb)) AS answer_count,
      dt.voice_path IS NOT NULL AS voice_captured,
      dt.video_path IS NOT NULL AS video_captured
    FROM public.depression_tests dt
    WHERE dt.status = 'completed'
  ),
  assessment_rows AS (
    SELECT
      ab.*,
      CASE
        WHEN ab.wellness_score IS NULL THEN 'unknown'
        WHEN ab.wellness_score < 30 THEN 'high'
        WHEN ab.wellness_score < 55 THEN 'medium'
        ELSE 'steady'
      END AS risk_level
    FROM assessment_base ab
  ),
  daily AS (
    SELECT
      date_trunc('day', ar.created_at)::date AS day,
      COUNT(*) AS completed,
      ROUND(AVG(ar.wellness_score)::numeric, 1) AS avg_wellness,
      COUNT(*) FILTER (WHERE ar.wellness_score IS NOT NULL AND ar.wellness_score < 30) AS high_risk
    FROM assessment_rows ar
    WHERE ar.created_at >= current_date - interval '13 days'
    GROUP BY date_trunc('day', ar.created_at)::date
  ),
  recent AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'assessmentId', limited.assessment_id,
      'userId', limited.user_id,
      'name', NULLIF(p.name, ''),
      'email', p.email,
      'createdAt', limited.created_at,
      'wellnessScore', limited.wellness_score,
      'riskLevel', limited.risk_level,
      'answerCount', limited.answer_count,
      'voiceCaptured', limited.voice_captured,
      'videoCaptured', limited.video_captured,
      'alertStatus', COALESCE(arr.alert_status, 'open')
    ) ORDER BY limited.created_at DESC), '[]'::jsonb) AS assessments
    FROM (
      SELECT *
      FROM assessment_rows
      ORDER BY created_at DESC
      LIMIT 8
    ) limited
    LEFT JOIN public.profiles p ON p.id = limited.user_id
    LEFT JOIN public.admin_risk_alert_reviews arr ON arr.assessment_id = limited.assessment_id
  )
  SELECT jsonb_build_object(
    'totalCompleted', COALESCE((SELECT COUNT(*) FROM assessment_rows), 0),
    'last7Completed', COALESCE((SELECT COUNT(*) FROM assessment_rows WHERE created_at >= now() - interval '7 days'), 0),
    'last30Completed', COALESCE((SELECT COUNT(*) FROM assessment_rows WHERE created_at >= now() - interval '30 days'), 0),
    'averageWellness', (SELECT ROUND(AVG(wellness_score)::numeric, 1) FROM assessment_rows),
    'voiceCaptured', COALESCE((SELECT COUNT(*) FROM assessment_rows WHERE voice_captured), 0),
    'videoCaptured', COALESCE((SELECT COUNT(*) FROM assessment_rows WHERE video_captured), 0),
    'severityDistribution', jsonb_build_object(
      'high', COALESCE((SELECT COUNT(*) FROM assessment_rows WHERE risk_level = 'high'), 0),
      'medium', COALESCE((SELECT COUNT(*) FROM assessment_rows WHERE risk_level = 'medium'), 0),
      'steady', COALESCE((SELECT COUNT(*) FROM assessment_rows WHERE risk_level = 'steady'), 0),
      'unknown', COALESCE((SELECT COUNT(*) FROM assessment_rows WHERE risk_level = 'unknown'), 0)
    ),
    'weeklyTrend', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'date', day,
        'completed', completed,
        'avgWellness', avg_wellness,
        'highRisk', high_risk
      ) ORDER BY day)
      FROM daily
    ), '[]'::jsonb),
    'recentAssessments', COALESCE((SELECT assessments FROM recent), '[]'::jsonb),
    'generatedAt', now()
  )
  INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_risk_alerts(_limit integer DEFAULT 20, _status text DEFAULT 'all')
RETURNS TABLE (
  assessment_id uuid,
  user_id uuid,
  name text,
  email text,
  created_at timestamptz,
  wellness_score integer,
  risk_level text,
  answer_count integer,
  voice_captured boolean,
  video_captured boolean,
  alert_status text,
  priority text,
  admin_note text,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  WITH assessment_base AS (
    SELECT
      dt.id AS assessment_id,
      dt.user_id,
      NULLIF(p.name, '') AS name,
      p.email,
      dt.created_at,
      public.admin_assessment_wellness_score(dt.text_answers) AS wellness_score,
      jsonb_array_length(COALESCE(dt.text_answers, '[]'::jsonb)) AS answer_count,
      dt.voice_path IS NOT NULL AS voice_captured,
      dt.video_path IS NOT NULL AS video_captured
    FROM public.depression_tests dt
    LEFT JOIN public.profiles p ON p.id = dt.user_id
    WHERE dt.status = 'completed'
  ),
  alert_rows AS (
    SELECT
      ab.*,
      CASE
        WHEN ab.wellness_score < 30 THEN 'high'
        ELSE 'medium'
      END AS risk_level,
      COALESCE(arr.alert_status, 'open') AS alert_status,
      COALESCE(
        arr.priority,
        CASE
          WHEN ab.wellness_score < 20 THEN 'urgent'
          WHEN ab.wellness_score < 30 THEN 'high'
          ELSE 'watch'
        END
      ) AS priority,
      arr.admin_note,
      arr.updated_at
    FROM assessment_base ab
    LEFT JOIN public.admin_risk_alert_reviews arr ON arr.assessment_id = ab.assessment_id
    WHERE ab.wellness_score IS NOT NULL
      AND ab.wellness_score < 55
  )
  SELECT
    ar.assessment_id,
    ar.user_id,
    ar.name,
    ar.email,
    ar.created_at,
    ar.wellness_score,
    ar.risk_level,
    ar.answer_count,
    ar.voice_captured,
    ar.video_captured,
    ar.alert_status,
    ar.priority,
    ar.admin_note,
    ar.updated_at
  FROM alert_rows ar
  WHERE COALESCE(_status, 'all') = 'all'
    OR ar.alert_status = _status
  ORDER BY
    CASE ar.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
    ar.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 20), 1), 100);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_admin_risk_alert_status(
  _assessment_id uuid,
  _alert_status text,
  _priority text DEFAULT 'high',
  _admin_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.admin_risk_alert_reviews%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF _alert_status NOT IN ('open', 'acknowledged', 'resolved') THEN
    RAISE EXCEPTION 'Invalid alert status';
  END IF;

  IF _priority NOT IN ('watch', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Invalid priority';
  END IF;

  INSERT INTO public.admin_risk_alert_reviews (assessment_id, alert_status, priority, admin_note, updated_by, updated_at)
  VALUES (_assessment_id, _alert_status, _priority, NULLIF(_admin_note, ''), auth.uid(), now())
  ON CONFLICT (assessment_id)
  DO UPDATE SET
    alert_status = EXCLUDED.alert_status,
    priority = EXCLUDED.priority,
    admin_note = EXCLUDED.admin_note,
    updated_by = EXCLUDED.updated_by,
    updated_at = now()
  RETURNING * INTO updated_row;

  RETURN jsonb_build_object(
    'assessmentId', updated_row.assessment_id,
    'alertStatus', updated_row.alert_status,
    'priority', updated_row.priority,
    'adminNote', updated_row.admin_note,
    'updatedAt', updated_row.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_assessment_analytics() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_risk_alerts(integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_admin_risk_alert_status(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_assessment_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_risk_alerts(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_admin_risk_alert_status(uuid, text, text, text) TO authenticated;
