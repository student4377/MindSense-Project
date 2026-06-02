CREATE TABLE IF NOT EXISTS public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type text NOT NULL DEFAULT 'general_support' CHECK (
    request_type IN ('general_support', 'therapy_guidance', 'professional_directory', 'crisis_guidance', 'account_support')
  ),
  subject text NOT NULL,
  message text NOT NULL,
  urgency text NOT NULL DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'escalated')),
  admin_reply text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamp with time zone,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own support requests" ON public.support_requests;
DROP POLICY IF EXISTS "Users insert own support requests" ON public.support_requests;
DROP POLICY IF EXISTS "Admins view support requests" ON public.support_requests;
DROP POLICY IF EXISTS "Admins update support requests" ON public.support_requests;
DROP POLICY IF EXISTS "Admins delete support requests" ON public.support_requests;

CREATE POLICY "Users view own support requests"
  ON public.support_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own support requests"
  ON public.support_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view support requests"
  ON public.support_requests FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins update support requests"
  ON public.support_requests FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete support requests"
  ON public.support_requests FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_support_requests_status_created
  ON public.support_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_requests_user_created
  ON public.support_requests(user_id, created_at DESC);

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
    SELECT mood_entries.user_id FROM public.mood_entries WHERE mood_entries.created_at >= now() - interval '7 days'
    UNION
    SELECT depression_tests.user_id FROM public.depression_tests WHERE depression_tests.created_at >= now() - interval '7 days'
    UNION
    SELECT support_activity_history.user_id FROM public.support_activity_history WHERE support_activity_history.completed_at >= now() - interval '7 days'
    UNION
    SELECT support_requests.user_id FROM public.support_requests WHERE support_requests.created_at >= now() - interval '7 days'
    UNION
    SELECT resource_progress.user_id FROM public.resource_progress WHERE resource_progress.last_viewed >= now() - interval '7 days'
  ),
  assessment_scores AS (
    SELECT public.admin_assessment_wellness_score(text_answers) AS wellness_score
    FROM public.depression_tests
    WHERE status = 'completed'
  )
  SELECT jsonb_build_object(
    'totalUsers', COALESCE((SELECT COUNT(*) FROM public.profiles), 0),
    'activeUsers', COALESCE((SELECT COUNT(DISTINCT activity_users.user_id) FROM activity_users), 0),
    'depressionTestsCompleted', COALESCE((SELECT COUNT(*) FROM public.depression_tests WHERE status = 'completed'), 0),
    'moodEntriesLogged', COALESCE((SELECT COUNT(*) FROM public.mood_entries), 0),
    'supportSessions', COALESCE((SELECT COUNT(*) FROM public.support_activity_history), 0),
    'supportRequests', COALESCE((SELECT COUNT(*) FROM public.support_requests), 0),
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

CREATE OR REPLACE FUNCTION public.get_admin_support_request_stats()
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

  SELECT jsonb_build_object(
    'total', COALESCE(COUNT(*), 0),
    'pending', COALESCE(COUNT(*) FILTER (WHERE status = 'pending'), 0),
    'inProgress', COALESCE(COUNT(*) FILTER (WHERE status = 'in_progress'), 0),
    'resolved', COALESCE(COUNT(*) FILTER (WHERE status = 'resolved'), 0),
    'escalated', COALESCE(COUNT(*) FILTER (WHERE status = 'escalated'), 0),
    'urgent', COALESCE(COUNT(*) FILTER (WHERE urgency = 'urgent'), 0),
    'last7', COALESCE(COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days'), 0)
  )
  INTO result
  FROM public.support_requests;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_support_requests(
  _limit integer DEFAULT 20,
  _status text DEFAULT 'all',
  _search text DEFAULT ''
)
RETURNS TABLE (
  request_id uuid,
  user_id uuid,
  name text,
  email text,
  request_type text,
  subject text,
  message text,
  urgency text,
  status text,
  admin_reply text,
  assigned_to uuid,
  created_at timestamptz,
  updated_at timestamptz,
  latest_mood integer,
  latest_wellness_score integer,
  completed_tests bigint,
  mood_entries bigint
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
  WITH latest_mood AS (
    SELECT DISTINCT ON (mood_entries.user_id)
      mood_entries.user_id,
      mood_entries.mood AS latest_mood
    FROM public.mood_entries
    ORDER BY mood_entries.user_id, mood_entries.entry_date DESC, mood_entries.created_at DESC
  ),
  mood_counts AS (
    SELECT mood_entries.user_id, COUNT(*) AS mood_entries
    FROM public.mood_entries
    GROUP BY mood_entries.user_id
  ),
  latest_test AS (
    SELECT DISTINCT ON (depression_tests.user_id)
      depression_tests.user_id,
      public.admin_assessment_wellness_score(depression_tests.text_answers) AS latest_wellness_score
    FROM public.depression_tests
    WHERE depression_tests.status = 'completed'
    ORDER BY depression_tests.user_id, depression_tests.created_at DESC
  ),
  test_counts AS (
    SELECT depression_tests.user_id, COUNT(*) FILTER (WHERE depression_tests.status = 'completed') AS completed_tests
    FROM public.depression_tests
    GROUP BY depression_tests.user_id
  )
  SELECT
    sr.id::uuid AS request_id,
    sr.user_id::uuid AS user_id,
    NULLIF(p.name, '')::text AS name,
    p.email::text AS email,
    sr.request_type::text AS request_type,
    sr.subject::text AS subject,
    sr.message::text AS message,
    sr.urgency::text AS urgency,
    sr.status::text AS status,
    sr.admin_reply::text AS admin_reply,
    sr.assigned_to::uuid AS assigned_to,
    sr.created_at::timestamptz AS created_at,
    sr.updated_at::timestamptz AS updated_at,
    lm.latest_mood::integer AS latest_mood,
    lt.latest_wellness_score::integer AS latest_wellness_score,
    COALESCE(tc.completed_tests, 0)::bigint AS completed_tests,
    COALESCE(mc.mood_entries, 0)::bigint AS mood_entries
  FROM public.support_requests sr
  LEFT JOIN public.profiles p ON p.id = sr.user_id
  LEFT JOIN latest_mood lm ON lm.user_id = sr.user_id
  LEFT JOIN latest_test lt ON lt.user_id = sr.user_id
  LEFT JOIN test_counts tc ON tc.user_id = sr.user_id
  LEFT JOIN mood_counts mc ON mc.user_id = sr.user_id
  WHERE (COALESCE(_status, 'all') = 'all' OR sr.status = _status)
    AND (
      COALESCE(_search, '') = ''
      OR p.name ILIKE '%' || _search || '%'
      OR p.email ILIKE '%' || _search || '%'
      OR sr.subject ILIKE '%' || _search || '%'
      OR sr.request_type ILIKE '%' || _search || '%'
    )
  ORDER BY
    CASE sr.urgency WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
    CASE sr.status WHEN 'pending' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'escalated' THEN 3 ELSE 4 END,
    sr.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 20), 1), 100);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_admin_support_request_status(
  _request_id uuid,
  _status text,
  _urgency text DEFAULT 'normal',
  _admin_reply text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.support_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF _status NOT IN ('pending', 'in_progress', 'resolved', 'escalated') THEN
    RAISE EXCEPTION 'Invalid support request status';
  END IF;

  IF _urgency NOT IN ('low', 'normal', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Invalid support request urgency';
  END IF;

  UPDATE public.support_requests
  SET
    status = _status,
    urgency = _urgency,
    admin_reply = NULLIF(_admin_reply, ''),
    assigned_to = auth.uid(),
    resolved_at = CASE WHEN _status = 'resolved' THEN now() ELSE resolved_at END,
    updated_by = auth.uid(),
    updated_at = now()
  WHERE id = _request_id
  RETURNING * INTO updated_row;

  IF updated_row.id IS NULL THEN
    RAISE EXCEPTION 'Support request not found';
  END IF;

  RETURN jsonb_build_object(
    'requestId', updated_row.id,
    'status', updated_row.status,
    'urgency', updated_row.urgency,
    'adminReply', updated_row.admin_reply,
    'updatedAt', updated_row.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_overview() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_support_request_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_support_requests(integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_admin_support_request_status(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_support_request_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_support_requests(integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_admin_support_request_status(uuid, text, text, text) TO authenticated;
