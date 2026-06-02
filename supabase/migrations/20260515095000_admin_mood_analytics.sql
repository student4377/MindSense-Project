CREATE OR REPLACE FUNCTION public.get_admin_mood_analytics()
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

  WITH mood_rows AS (
    SELECT
      mood_entries.id,
      mood_entries.user_id,
      mood_entries.mood,
      mood_entries.energy,
      mood_entries.sleep_quality,
      mood_entries.tags,
      mood_entries.entry_date,
      mood_entries.created_at
    FROM public.mood_entries
  ),
  days AS (
    SELECT generate_series(current_date - interval '13 days', current_date, interval '1 day')::date AS day
  ),
  daily_raw AS (
    SELECT
      mood_rows.entry_date AS day,
      COUNT(*) AS entries,
      ROUND(AVG(mood_rows.mood)::numeric, 1) AS avg_mood,
      ROUND(AVG(mood_rows.energy)::numeric, 1) AS avg_energy,
      ROUND(AVG(mood_rows.sleep_quality)::numeric, 1) AS avg_sleep,
      COUNT(*) FILTER (WHERE mood_rows.mood <= 2) AS low_mood
    FROM mood_rows
    WHERE mood_rows.entry_date >= current_date - interval '13 days'
    GROUP BY mood_rows.entry_date
  ),
  daily AS (
    SELECT
      days.day,
      COALESCE(daily_raw.entries, 0) AS entries,
      daily_raw.avg_mood,
      daily_raw.avg_energy,
      daily_raw.avg_sleep,
      COALESCE(daily_raw.low_mood, 0) AS low_mood
    FROM days
    LEFT JOIN daily_raw ON daily_raw.day = days.day
  ),
  tag_counts AS (
    SELECT
      tag_name::text AS tag,
      COUNT(*) AS total,
      ROUND(AVG(mood_rows.mood)::numeric, 1) AS avg_mood,
      COUNT(*) FILTER (WHERE mood_rows.mood <= 2) AS low_mood,
      COUNT(*) FILTER (WHERE mood_rows.mood >= 4) AS high_mood
    FROM mood_rows
    CROSS JOIN LATERAL unnest(COALESCE(mood_rows.tags, '{}'::text[])) AS tags(tag_name)
    GROUP BY tag_name
    ORDER BY total DESC, avg_mood ASC
    LIMIT 8
  ),
  recent_low AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'userId', limited.user_id,
      'name', NULLIF(p.name, ''),
      'email', p.email,
      'mood', limited.mood,
      'energy', limited.energy,
      'sleepQuality', limited.sleep_quality,
      'entryDate', limited.entry_date,
      'createdAt', limited.created_at,
      'tags', COALESCE(limited.tags, '{}'::text[])
    ) ORDER BY limited.created_at DESC), '[]'::jsonb) AS entries
    FROM (
      SELECT *
      FROM mood_rows
      WHERE mood <= 2
      ORDER BY created_at DESC
      LIMIT 8
    ) limited
    LEFT JOIN public.profiles p ON p.id = limited.user_id
  )
  SELECT jsonb_build_object(
    'totalEntries', COALESCE((SELECT COUNT(*) FROM mood_rows), 0),
    'last7Entries', COALESCE((SELECT COUNT(*) FROM mood_rows WHERE entry_date >= current_date - interval '6 days'), 0),
    'last30Entries', COALESCE((SELECT COUNT(*) FROM mood_rows WHERE entry_date >= current_date - interval '29 days'), 0),
    'averageMood', (SELECT ROUND(AVG(mood)::numeric, 1) FROM mood_rows),
    'averageEnergy', (SELECT ROUND(AVG(energy)::numeric, 1) FROM mood_rows),
    'averageSleep', (SELECT ROUND(AVG(sleep_quality)::numeric, 1) FROM mood_rows),
    'lowMoodSignals', COALESCE((SELECT COUNT(*) FROM mood_rows WHERE mood <= 2 AND entry_date >= current_date - interval '6 days'), 0),
    'poorSleepSignals', COALESCE((SELECT COUNT(*) FROM mood_rows WHERE sleep_quality <= 4 AND entry_date >= current_date - interval '6 days'), 0),
    'lowEnergySignals', COALESCE((SELECT COUNT(*) FROM mood_rows WHERE energy <= 4 AND entry_date >= current_date - interval '6 days'), 0),
    'moodDistribution', jsonb_build_object(
      '1', COALESCE((SELECT COUNT(*) FROM mood_rows WHERE mood = 1), 0),
      '2', COALESCE((SELECT COUNT(*) FROM mood_rows WHERE mood = 2), 0),
      '3', COALESCE((SELECT COUNT(*) FROM mood_rows WHERE mood = 3), 0),
      '4', COALESCE((SELECT COUNT(*) FROM mood_rows WHERE mood = 4), 0),
      '5', COALESCE((SELECT COUNT(*) FROM mood_rows WHERE mood = 5), 0)
    ),
    'dailyTrend', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'date', day,
        'entries', entries,
        'avgMood', avg_mood,
        'avgEnergy', avg_energy,
        'avgSleep', avg_sleep,
        'lowMood', low_mood
      ) ORDER BY day)
      FROM daily
    ), '[]'::jsonb),
    'tagSignals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'tag', tag,
        'total', total,
        'avgMood', avg_mood,
        'lowMood', low_mood,
        'highMood', high_mood
      ) ORDER BY total DESC)
      FROM tag_counts
    ), '[]'::jsonb),
    'recentLowMoodEntries', COALESCE((SELECT entries FROM recent_low), '[]'::jsonb),
    'generatedAt', now()
  )
  INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_mood_analytics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_mood_analytics() TO authenticated;
