CREATE TABLE IF NOT EXISTS public.admin_user_review_statuses (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  review_status text NOT NULL DEFAULT 'active' CHECK (review_status IN ('active', 'watch', 'needs_support', 'restricted')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'medium', 'high')),
  admin_note text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_user_review_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view user review statuses" ON public.admin_user_review_statuses;
DROP POLICY IF EXISTS "Admins insert user review statuses" ON public.admin_user_review_statuses;
DROP POLICY IF EXISTS "Admins update user review statuses" ON public.admin_user_review_statuses;
DROP POLICY IF EXISTS "Admins delete user review statuses" ON public.admin_user_review_statuses;

CREATE POLICY "Admins view user review statuses"
  ON public.admin_user_review_statuses FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins insert user review statuses"
  ON public.admin_user_review_statuses FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins update user review statuses"
  ON public.admin_user_review_statuses FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete user review statuses"
  ON public.admin_user_review_statuses FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

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
    COALESCE(aurs.review_status, 'active') AS account_status
  FROM public.profiles p
  LEFT JOIN mood_summary ms ON ms.user_id = p.id
  LEFT JOIN test_summary ts ON ts.user_id = p.id
  LEFT JOIN support_summary ss ON ss.user_id = p.id
  LEFT JOIN progress_summary ps ON ps.user_id = p.id
  LEFT JOIN latest_tests lt ON lt.user_id = p.id
  LEFT JOIN public.admin_user_review_statuses aurs ON aurs.user_id = p.id
  WHERE COALESCE(_search, '') = ''
    OR p.name ILIKE '%' || _search || '%'
    OR p.email ILIKE '%' || _search || '%'
  ORDER BY latest_activity DESC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 8), 1), 50);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_user_detail(_user_id uuid)
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

  WITH profile_row AS (
    SELECT p.id, NULLIF(p.name, '') AS name, p.email, p.created_at
    FROM public.profiles p
    WHERE p.id = _user_id
  ),
  status_row AS (
    SELECT aurs.review_status, aurs.priority, aurs.admin_note, aurs.updated_at
    FROM public.admin_user_review_statuses aurs
    WHERE aurs.user_id = _user_id
  ),
  mood_summary AS (
    SELECT
      COUNT(*) AS total_entries,
      COUNT(*) FILTER (WHERE entry_date >= current_date - interval '7 days') AS last7_entries,
      ROUND((AVG(mood) FILTER (WHERE entry_date >= current_date - interval '7 days'))::numeric, 1) AS avg_mood,
      ROUND((AVG(energy) FILTER (WHERE entry_date >= current_date - interval '7 days'))::numeric, 1) AS avg_energy,
      ROUND((AVG(sleep_quality) FILTER (WHERE entry_date >= current_date - interval '7 days'))::numeric, 1) AS avg_sleep,
      MAX(created_at) AS latest
    FROM public.mood_entries
    WHERE user_id = _user_id
  ),
  top_tags AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('tag', tag_name, 'count', total) ORDER BY total DESC), '[]'::jsonb) AS tags
    FROM (
      SELECT tag_name, COUNT(*) AS total
      FROM public.mood_entries m
      CROSS JOIN LATERAL unnest(COALESCE(m.tags, '{}'::text[])) AS tags(tag_name)
      WHERE m.user_id = _user_id
      GROUP BY tag_name
      ORDER BY total DESC
      LIMIT 6
    ) tag_counts
  ),
  latest_test AS (
    SELECT
      dt.created_at,
      dt.status,
      public.admin_assessment_wellness_score(dt.text_answers) AS wellness_score,
      jsonb_array_length(COALESCE(dt.text_answers, '[]'::jsonb)) AS answer_count,
      dt.voice_path IS NOT NULL AS voice_captured,
      dt.video_path IS NOT NULL AS video_captured
    FROM public.depression_tests dt
    WHERE dt.user_id = _user_id
    ORDER BY dt.created_at DESC
    LIMIT 1
  ),
  test_summary AS (
    SELECT COUNT(*) FILTER (WHERE status = 'completed') AS completed_tests, MAX(created_at) AS latest
    FROM public.depression_tests
    WHERE user_id = _user_id
  ),
  support_summary AS (
    SELECT COUNT(*) AS total_sessions, MAX(completed_at) AS latest
    FROM public.support_activity_history
    WHERE user_id = _user_id
  ),
  support_by_type AS (
    SELECT COALESCE(jsonb_object_agg(activity_type, total), '{}'::jsonb) AS by_type
    FROM (
      SELECT activity_type, COUNT(*) AS total
      FROM public.support_activity_history
      WHERE user_id = _user_id
      GROUP BY activity_type
    ) support_counts
  ),
  resource_summary AS (
    SELECT COUNT(*) AS resources_opened, MAX(last_viewed) AS latest
    FROM public.resource_progress
    WHERE user_id = _user_id
  ),
  recent_activity AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'source', source,
      'title', title,
      'occurredAt', occurred_at,
      'metadata', metadata
    ) ORDER BY occurred_at DESC), '[]'::jsonb) AS events
    FROM (
      SELECT * FROM (
        SELECT
          'mood'::text AS source,
          'Mood entry'::text AS title,
          m.created_at AS occurred_at,
          jsonb_build_object('mood', m.mood, 'energy', m.energy, 'sleep', m.sleep_quality) AS metadata
        FROM public.mood_entries m
        WHERE m.user_id = _user_id
        UNION ALL
        SELECT
          'assessment'::text AS source,
          'Depression test'::text AS title,
          dt.created_at AS occurred_at,
          jsonb_build_object(
            'wellnessScore', public.admin_assessment_wellness_score(dt.text_answers),
            'voiceCaptured', dt.voice_path IS NOT NULL,
            'videoCaptured', dt.video_path IS NOT NULL
          ) AS metadata
        FROM public.depression_tests dt
        WHERE dt.user_id = _user_id
        UNION ALL
        SELECT
          'support'::text AS source,
          sah.title,
          sah.completed_at AS occurred_at,
          jsonb_build_object('type', sah.activity_type, 'durationSeconds', sah.duration_seconds) AS metadata
        FROM public.support_activity_history sah
        WHERE sah.user_id = _user_id
      ) raw_events
      ORDER BY occurred_at DESC
      LIMIT 8
    ) limited_events
  )
  SELECT jsonb_build_object(
    'profile', COALESCE((
      SELECT jsonb_build_object(
        'userId', id,
        'name', name,
        'email', email,
        'joinedAt', created_at
      )
      FROM profile_row
    ), '{}'::jsonb),
    'reviewStatus', COALESCE((
      SELECT jsonb_build_object(
        'reviewStatus', review_status,
        'priority', priority,
        'adminNote', admin_note,
        'updatedAt', updated_at
      )
      FROM status_row
    ), jsonb_build_object('reviewStatus', 'active', 'priority', 'normal', 'adminNote', NULL, 'updatedAt', NULL)),
    'moodSummary', jsonb_build_object(
      'totalEntries', COALESCE((SELECT total_entries FROM mood_summary), 0),
      'last7Entries', COALESCE((SELECT last7_entries FROM mood_summary), 0),
      'avgMood', (SELECT avg_mood FROM mood_summary),
      'avgEnergy', (SELECT avg_energy FROM mood_summary),
      'avgSleep', (SELECT avg_sleep FROM mood_summary),
      'topTags', COALESCE((SELECT tags FROM top_tags), '[]'::jsonb)
    ),
    'latestTest', COALESCE((
      SELECT jsonb_build_object(
        'createdAt', created_at,
        'status', status,
        'wellnessScore', wellness_score,
        'answerCount', answer_count,
        'voiceCaptured', voice_captured,
        'videoCaptured', video_captured
      )
      FROM latest_test
    ), 'null'::jsonb),
    'testSummary', jsonb_build_object(
      'completedTests', COALESCE((SELECT completed_tests FROM test_summary), 0)
    ),
    'supportSummary', jsonb_build_object(
      'totalSessions', COALESCE((SELECT total_sessions FROM support_summary), 0),
      'byType', COALESCE((SELECT by_type FROM support_by_type), '{}'::jsonb)
    ),
    'resourceSummary', jsonb_build_object(
      'resourcesOpened', COALESCE((SELECT resources_opened FROM resource_summary), 0),
      'lastViewed', (SELECT latest FROM resource_summary)
    ),
    'activity', jsonb_build_object(
      'latestActivity', GREATEST(
        COALESCE((SELECT latest FROM mood_summary), (SELECT created_at FROM profile_row)),
        COALESCE((SELECT latest FROM test_summary), (SELECT created_at FROM profile_row)),
        COALESCE((SELECT latest FROM support_summary), (SELECT created_at FROM profile_row)),
        COALESCE((SELECT latest FROM resource_summary), (SELECT created_at FROM profile_row))
      )
    ),
    'recentActivity', COALESCE((SELECT events FROM recent_activity), '[]'::jsonb)
  )
  INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_admin_user_review_status(
  _user_id uuid,
  _review_status text,
  _priority text DEFAULT 'normal',
  _admin_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.admin_user_review_statuses%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF _review_status NOT IN ('active', 'watch', 'needs_support', 'restricted') THEN
    RAISE EXCEPTION 'Invalid review status';
  END IF;

  IF _priority NOT IN ('normal', 'medium', 'high') THEN
    RAISE EXCEPTION 'Invalid priority';
  END IF;

  INSERT INTO public.admin_user_review_statuses (user_id, review_status, priority, admin_note, updated_by, updated_at)
  VALUES (_user_id, _review_status, _priority, NULLIF(_admin_note, ''), auth.uid(), now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    review_status = EXCLUDED.review_status,
    priority = EXCLUDED.priority,
    admin_note = EXCLUDED.admin_note,
    updated_by = EXCLUDED.updated_by,
    updated_at = now()
  RETURNING * INTO updated_row;

  RETURN jsonb_build_object(
    'userId', updated_row.user_id,
    'reviewStatus', updated_row.review_status,
    'priority', updated_row.priority,
    'adminNote', updated_row.admin_note,
    'updatedAt', updated_row.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_user_detail(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_admin_user_review_status(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_user_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_admin_user_review_status(uuid, text, text, text) TO authenticated;
