DO $$
BEGIN
  IF to_regclass('public.depression_tests') IS NULL THEN
    RAISE NOTICE 'Skipping depression_tests user FK: table does not exist.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'depression_tests_user_id_fkey'
      AND conrelid = 'public.depression_tests'::regclass
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.depression_tests dt
    LEFT JOIN auth.users au ON au.id = dt.user_id
    WHERE au.id IS NULL
    LIMIT 1
  ) THEN
    RAISE NOTICE 'Skipping depression_tests user FK: orphan user_id rows exist.';
    RETURN;
  END IF;

  ALTER TABLE public.depression_tests
    ADD CONSTRAINT depression_tests_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;

CREATE INDEX IF NOT EXISTS depression_tests_user_created_idx
  ON public.depression_tests (user_id, created_at DESC);
