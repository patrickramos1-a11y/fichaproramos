CREATE TABLE public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read app_users" ON public.app_users FOR SELECT USING (true);
CREATE POLICY "anyone can insert app_users" ON public.app_users FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone can delete app_users" ON public.app_users FOR DELETE USING (true);