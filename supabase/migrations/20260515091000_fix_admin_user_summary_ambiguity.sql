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

REVOKE ALL ON FUNCTION public.get_admin_user_summaries(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_user_summaries(integer, text) TO authenticated;
