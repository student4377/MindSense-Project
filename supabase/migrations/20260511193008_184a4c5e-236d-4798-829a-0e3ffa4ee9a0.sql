
-- Admins table + helper
CREATE TABLE public.admins (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = _uid) $$;

CREATE POLICY "Admins view admins" ON public.admins FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Resources
CREATE TABLE public.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('article','video','audio')),
  category text,
  topic text,
  thumbnail_url text,
  content_url text,
  content_body text,
  duration text,
  featured boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view resources" ON public.resources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert resources" ON public.resources FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update resources" ON public.resources FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete resources" ON public.resources FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Bookmarks
CREATE TABLE public.resource_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, resource_id)
);
ALTER TABLE public.resource_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own bookmarks" ON public.resource_bookmarks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own bookmarks" ON public.resource_bookmarks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own bookmarks" ON public.resource_bookmarks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Progress
CREATE TABLE public.resource_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  progress smallint NOT NULL DEFAULT 0,
  last_viewed timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, resource_id)
);
ALTER TABLE public.resource_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own progress" ON public.resource_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own progress" ON public.resource_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own progress" ON public.resource_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own progress" ON public.resource_progress FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('resource-media', 'resource-media', true);
CREATE POLICY "Public read resource-media" ON storage.objects FOR SELECT USING (bucket_id = 'resource-media');
CREATE POLICY "Admins upload resource-media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'resource-media' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins update resource-media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'resource-media' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins delete resource-media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'resource-media' AND public.is_admin(auth.uid()));
