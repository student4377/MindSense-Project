CREATE OR REPLACE FUNCTION public.get_current_user_access_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  status_row public.admin_user_review_statuses%ROWTYPE;
  user_is_admin boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT public.is_admin(auth.uid()) INTO user_is_admin;

  SELECT *
  INTO status_row
  FROM public.admin_user_review_statuses
  WHERE user_id = auth.uid();

  RETURN jsonb_build_object(
    'reviewStatus', COALESCE(status_row.review_status, 'active'),
    'priority', COALESCE(status_row.priority, 'normal'),
    'updatedAt', status_row.updated_at,
    'isAdmin', COALESCE(user_is_admin, false),
    'restricted', COALESCE(status_row.review_status, 'active') = 'restricted' AND NOT COALESCE(user_is_admin, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_current_user_access_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_user_access_status() TO authenticated;
