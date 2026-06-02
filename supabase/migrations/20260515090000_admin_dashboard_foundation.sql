CREATE OR REPLACE FUNCTION public.admin_assessment_wellness_score(_answers jsonb)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  WITH scores AS (
    SELECT NULLIF(answer->>'score', '')::numeric AS score
    FROM jsonb_array_elements(COALESCE(_answers, '[]'::jsonb)) AS answer
    WHERE answer ? 'score'
      AND (answer->>'score') ~ '^[0-9]+(\.[0-9]+)?$'
  ),
  averaged AS (
    SELECT AVG(score) AS average_score
    FROM scores
  )
  SELECT CASE
    WHEN average_score IS NULL THEN NULL
    ELSE GREATEST(0, LEAST(100, ROUND(((5 - average_score) / 4) * 100)::integer))
  END
  FROM averaged;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_overview()
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

  WITH activity_users AS (
    SELECT user_id FROM public.mood_entries WHERE created_at >= now() - interval '7 days'
    UNION
    SELECT user_id FROM public.depression_tests WHERE created_at >= now() - interval '7 days'
    UNION
    SELECT user_id FROM public.support_activity_history WHERE completed_at >= now() - interval '7 days'
    UNION
    SELECT user_id FROM public.resource_progress WHERE last_viewed >= now() - interval '7 days'
  ),
  assessment_scores AS (
    SELECT public.admin_assessment_wellness_score(text_answers) AS wellness_score
    FROM public.depression_tests
    WHERE status = 'completed'
  )
  SELECT jsonb_build_object(
    'totalUsers', COALESCE((SELECT COUNT(*) FROM public.profiles), 0),
    'activeUsers', COALESCE((SELECT COUNT(DISTINCT user_id) FROM activity_users), 0),
    'depressionTestsCompleted', COALESCE((SELECT COUNT(*) FROM public.depression_tests WHERE status = 'completed'), 0),
    'moodEntriesLogged', COALESCE((SELECT COUNT(*) FROM public.mood_entries), 0),
    'supportSessions', COALESCE((SELECT COUNT(*) FROM public.support_activity_history), 0),
    'highRiskAlerts', COALESCE((SELECT COUNT(*) FROM assessment_scores WHERE wellness_score IS NOT NULL AND wellness_score < 30), 0),
    'publishedResources', COALESCE((SELECT COUNT(*) FROM public.resources WHERE is_published = true), 0),
    'resourceOpens', COALESCE((SELECT COUNT(*) FROM public.resource_progress), 0),
    'aiAnalysesCompleted', COALESCE((SELECT COUNT(*) FROM public.results), 0),
    'avgMood', (SELECT ROUND(AVG(mood)::numeric, 1) FROM public.mood_entries WHERE entry_date >= current_date - interval '7 days'),
    'avgEnergy', (SELECT ROUND(AVG(energy)::numeric, 1) FROM public.mood_entries WHERE entry_date >= current_date - interval '7 days'),
    'avgSleep', (SELECT ROUND(AVG(sleep_quality)::numeric, 1) FROM public.mood_entries WHERE entry_date >= current_date - interval '7 days'),
    'resourceCoverage', jsonb_build_object(
      'article', COALESCE((SELECT COUNT(*) FROM public.resources WHERE is_published = true AND type = 'article'), 0),
      'video', COALESCE((SELECT COUNT(*) FROM public.resources WHERE is_published = true AND type = 'video'), 0),
      'audio', COALESCE((SELECT COUNT(*) FROM public.resources WHERE is_published = true AND type = 'audio'), 0)
    ),
    'riskDistribution', jsonb_build_object(
      'high', COALESCE((SELECT COUNT(*) FROM assessment_scores WHERE wellness_score IS NOT NULL AND wellness_score < 30), 0),
      'medium', COALESCE((SELECT COUNT(*) FROM assessment_scores WHERE wellness_score >= 30 AND wellness_score < 55), 0),
      'steady', COALESCE((SELECT COUNT(*) FROM assessment_scores WHERE wellness_score >= 55), 0),
      'unknown', COALESCE((SELECT COUNT(*) FROM assessment_scores WHERE wellness_score IS NULL), 0)
    ),
    'generatedAt', now()
  )
  INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_user_summaries(_limit integer DEFAULT 8, _search text DEFAULT '')
RETURNS TABLE (
  user_id uuid,
  name text,
  email text,
  joined_at timestamptz,
  mood_entries bigint,
  completed_tests bigint,
  support_sessions bigint,
  latest_activity timestamptz,
  risk_level text,
  account_status text
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
  WITH mood_summary AS (
    SELECT mood_entries.user_id, COUNT(*) AS total, MAX(created_at) AS latest
    FROM public.mood_entries
    GROUP BY mood_entries.user_id
  ),
  test_summary AS (
    SELECT depression_tests.user_id, COUNT(*) FILTER (WHERE status = 'completed') AS total, MAX(created_at) AS latest
    FROM public.depression_tests
    GROUP BY depression_tests.user_id
  ),
  support_summary AS (
    SELECT support_activity_history.user_id, COUNT(*) AS total, MAX(completed_at) AS latest
    FROM public.support_activity_history
    GROUP BY support_activity_history.user_id
  ),
  progress_summary AS (
    SELECT resource_progress.user_id, MAX(last_viewed) AS latest
    FROM public.resource_progress
    GROUP BY resource_progress.user_id
  ),
  latest_tests AS (
    SELECT DISTINCT ON (depression_tests.user_id)
      depression_tests.user_id,
      public.admin_assessment_wellness_score(text_answers) AS wellness_score
    FROM public.depression_tests
    WHERE status = 'completed'
    ORDER BY depression_tests.user_id, depression_tests.created_at DESC
  )
  SELECT
    p.id AS user_id,
    NULLIF(p.name, '') AS name,
    p.email,
    p.created_at AS joined_at,
    COALESCE(ms.total, 0) AS mood_entries,
    COALESCE(ts.total, 0) AS completed_tests,
    COALESCE(ss.total, 0) AS support_sessions,
    GREATEST(
      COALESCE(ms.latest, p.created_at),
      COALESCE(ts.latest, p.created_at),
      COALESCE(ss.latest, p.created_at),
      COALESCE(ps.latest, p.created_at)
    ) AS latest_activity,
    CASE
      WHEN lt.wellness_score IS NULL THEN 'unknown'
      WHEN lt.wellness_score < 30 THEN 'high'
      WHEN lt.wellness_score < 55 THEN 'medium'
      ELSE 'steady'
    END AS risk_level,
    'active'::text AS account_status
  FROM public.profiles p
  LEFT JOIN mood_summary ms ON ms.user_id = p.id
  LEFT JOIN test_summary ts ON ts.user_id = p.id
  LEFT JOIN support_summary ss ON ss.user_id = p.id
  LEFT JOIN progress_summary ps ON ps.user_id = p.id
  LEFT JOIN latest_tests lt ON lt.user_id = p.id
  WHERE COALESCE(_search, '') = ''
    OR p.name ILIKE '%' || _search || '%'
    OR p.email ILIKE '%' || _search || '%'
  ORDER BY latest_activity DESC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 8), 1), 50);
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_overview() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_user_summaries(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_user_summaries(integer, text) TO authenticated;
