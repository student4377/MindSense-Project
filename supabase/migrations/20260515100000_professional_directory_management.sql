CREATE TABLE IF NOT EXISTS public.mental_health_professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL,
  specialization text NOT NULL,
  city text NOT NULL,
  location text NOT NULL,
  address text,
  phone text,
  map_url text,
  source_label text,
  source_url text,
  verification_status text NOT NULL DEFAULT 'public_source' CHECK (
    verification_status IN ('public_source', 'admin_reviewed', 'needs_verification')
  ),
  is_published boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.mental_health_professionals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view published professionals" ON public.mental_health_professionals;
DROP POLICY IF EXISTS "Admins view professionals" ON public.mental_health_professionals;
DROP POLICY IF EXISTS "Admins insert professionals" ON public.mental_health_professionals;
DROP POLICY IF EXISTS "Admins update professionals" ON public.mental_health_professionals;
DROP POLICY IF EXISTS "Admins delete professionals" ON public.mental_health_professionals;

CREATE POLICY "Users view published professionals"
  ON public.mental_health_professionals FOR SELECT TO authenticated
  USING (is_published = true);

CREATE POLICY "Admins view professionals"
  ON public.mental_health_professionals FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins insert professionals"
  ON public.mental_health_professionals FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins update professionals"
  ON public.mental_health_professionals FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete professionals"
  ON public.mental_health_professionals FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_professionals_published_city
  ON public.mental_health_professionals(is_published, city, name);

CREATE INDEX IF NOT EXISTS idx_professionals_featured
  ON public.mental_health_professionals(featured, is_published);

INSERT INTO public.mental_health_professionals (
  slug,
  name,
  role,
  specialization,
  city,
  location,
  address,
  phone,
  map_url,
  source_label,
  source_url,
  verification_status,
  is_published,
  featured
)
VALUES
  (
    'shifa-mehboob-yaqub',
    'Dr. Mehboob Yaqub',
    'Consultant psychiatrist',
    'Psychiatry',
    'Islamabad',
    'Shifa International Hospital',
    'Pitras Bukhari Road, H-8/4, Islamabad',
    NULL,
    'https://www.google.com/maps/search/?api=1&query=Shifa%20International%20Hospital%20Islamabad%20Pakistan',
    'Shifa International Hospitals',
    'https://www.shifa.com.pk/doctors/dr-mehboob-yaqub',
    'public_source',
    true,
    true
  ),
  (
    'lgh-faiza-athar',
    'Dr. Faiza Athar',
    'Head of Psychiatry Department',
    'Psychiatry',
    'Lahore',
    'Lahore General Hospital',
    'Ferozepur Road, Lahore',
    NULL,
    'https://www.google.com/maps/search/?api=1&query=Lahore%20General%20Hospital%20Lahore%20Pakistan',
    'Lahore General Hospital',
    'https://lgh.punjab.gov.pk/dept_psychiatry',
    'public_source',
    true,
    false
  ),
  (
    'lgh-asma-gull',
    'Dr. Asma Gull',
    'Senior psychologist',
    'Clinical psychology',
    'Lahore',
    'Lahore General Hospital',
    'Ferozepur Road, Lahore',
    NULL,
    'https://www.google.com/maps/search/?api=1&query=Lahore%20General%20Hospital%20Lahore%20Pakistan',
    'Lahore General Hospital',
    'https://lgh.punjab.gov.pk/dept_psychiatry',
    'public_source',
    true,
    false
  ),
  (
    'aku-hadia-pasha',
    'Dr. Hadia Pasha',
    'Clinical psychologist',
    'Student wellness and counselling',
    'Karachi',
    'Aga Khan University',
    'Stadium Road, Karachi',
    NULL,
    'https://www.google.com/maps/search/?api=1&query=Aga%20Khan%20University%20Karachi%20Pakistan',
    'Aga Khan University',
    'https://www.aku.edu/students/wellness/pk/about/Pages/our-team.aspx',
    'public_source',
    true,
    false
  ),
  (
    'aku-psychiatry',
    'AKUH Department of Psychiatry',
    'Hospital psychiatry service',
    'Psychiatry and mental health services',
    'Karachi',
    'Aga Khan University Hospital',
    'Stadium Road, Karachi',
    NULL,
    'https://www.google.com/maps/search/?api=1&query=Aga%20Khan%20University%20Hospital%20Karachi%20Pakistan',
    'Aga Khan University Hospital',
    'https://hospitals.aku.edu/pakistan/Health-Services/department-of-psychiatry/Pages/default.aspx',
    'public_source',
    true,
    true
  ),
  (
    'taskeen-health',
    'Taskeen Health Initiative',
    'Mental health support service',
    'Helpline and mental health awareness',
    'Karachi',
    'Taskeen Mental Health',
    'Karachi, Pakistan',
    '+92 316 8275336',
    'https://www.google.com/maps/search/?api=1&query=Taskeen%20Mental%20Health%20Karachi%20Pakistan',
    'Taskeen',
    'https://taskeen.org/program/mental-health-helpline/',
    'public_source',
    true,
    false
  ),
  (
    'umang-pakistan',
    'Umang Pakistan',
    'Mental health helpline',
    'Crisis listening and counselling support',
    'Lahore',
    'Umang Pakistan',
    'Lahore, Pakistan',
    '0311 7786264',
    'https://www.google.com/maps/search/?api=1&query=Umang%20Pakistan%20Lahore%20Pakistan',
    'Umang Pakistan',
    'https://umang.com.pk/',
    'public_source',
    true,
    false
  ),
  (
    'rozan-islamabad',
    'Rozan',
    'Counselling and psychosocial support',
    'Emotional health, violence prevention, and support',
    'Islamabad',
    'Rozan',
    'Pind Bhagwal Road, Islamabad 44000, Pakistan',
    NULL,
    'https://www.google.com/maps/search/?api=1&query=Rozan%20Islamabad%20Pakistan',
    'Rozan',
    'https://rozan.org/counseling-services/',
    'public_source',
    true,
    false
  ),
  (
    'fountain-house-lahore',
    'Fountain House Lahore',
    'Mental health rehabilitation service',
    'Psychiatric rehabilitation and community support',
    'Lahore',
    'Fountain House',
    'Lahore, Pakistan',
    NULL,
    'https://www.google.com/maps/search/?api=1&query=Fountain%20House%20Lahore%20Pakistan',
    'Fountain House',
    'https://www.fountainhouse.com.pk/index.html',
    'public_source',
    true,
    false
  )
ON CONFLICT (slug)
DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  specialization = EXCLUDED.specialization,
  city = EXCLUDED.city,
  location = EXCLUDED.location,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  map_url = EXCLUDED.map_url,
  source_label = EXCLUDED.source_label,
  source_url = EXCLUDED.source_url,
  verification_status = EXCLUDED.verification_status,
  is_published = EXCLUDED.is_published,
  featured = EXCLUDED.featured,
  updated_at = now();
