CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created
  ON public.admin_audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_entity
  ON public.admin_audit_logs(entity_type, created_at DESC);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Admins insert audit logs" ON public.admin_audit_logs;

CREATE POLICY "Admins view audit logs"
  ON public.admin_audit_logs FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins insert audit logs"
  ON public.admin_audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND admin_id = auth.uid());

CREATE OR REPLACE FUNCTION public.record_admin_audit_log(
  _action text,
  _entity_type text,
  _summary text,
  _entity_id text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_row public.admin_audit_logs%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  INSERT INTO public.admin_audit_logs (admin_id, action, entity_type, entity_id, summary, metadata)
  VALUES (
    auth.uid(),
    NULLIF(_action, ''),
    NULLIF(_entity_type, ''),
    NULLIF(_entity_id, ''),
    NULLIF(_summary, ''),
    COALESCE(_metadata, '{}'::jsonb)
  )
  RETURNING * INTO inserted_row;

  RETURN jsonb_build_object(
    'id', inserted_row.id,
    'adminId', inserted_row.admin_id,
    'action', inserted_row.action,
    'entityType', inserted_row.entity_type,
    'entityId', inserted_row.entity_id,
    'summary', inserted_row.summary,
    'metadata', inserted_row.metadata,
    'createdAt', inserted_row.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_audit_logs(
  _limit integer DEFAULT 30,
  _entity_type text DEFAULT 'all'
)
RETURNS TABLE (
  log_id uuid,
  admin_id uuid,
  admin_name text,
  admin_email text,
  action text,
  entity_type text,
  entity_id text,
  summary text,
  metadata jsonb,
  created_at timestamptz
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
  SELECT
    logs.id::uuid AS log_id,
    logs.admin_id::uuid AS admin_id,
    NULLIF(profiles.name, '')::text AS admin_name,
    profiles.email::text AS admin_email,
    logs.action::text AS action,
    logs.entity_type::text AS entity_type,
    logs.entity_id::text AS entity_id,
    logs.summary::text AS summary,
    logs.metadata::jsonb AS metadata,
    logs.created_at::timestamptz AS created_at
  FROM public.admin_audit_logs logs
  LEFT JOIN public.profiles profiles ON profiles.id = logs.admin_id
  WHERE COALESCE(_entity_type, 'all') = 'all'
    OR logs.entity_type = _entity_type
  ORDER BY logs.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 30), 1), 100);
END;
$$;

REVOKE ALL ON FUNCTION public.record_admin_audit_log(text, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_audit_logs(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_admin_audit_log(text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_audit_logs(integer, text) TO authenticated;
