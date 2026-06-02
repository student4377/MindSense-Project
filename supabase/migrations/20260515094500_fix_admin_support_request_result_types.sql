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

REVOKE ALL ON FUNCTION public.get_admin_support_requests(integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_support_requests(integer, text, text) TO authenticated;
