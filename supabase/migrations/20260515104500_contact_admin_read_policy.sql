ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view contacts" ON public.contacts;
DROP POLICY IF EXISTS "Admins view contacts" ON public.contacts;

CREATE POLICY "Admins view contacts"
  ON public.contacts FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
