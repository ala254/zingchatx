
-- shares (analytics + real-time counts)
CREATE TABLE public.shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  destination text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shares_video_id_idx ON public.shares(video_id);
CREATE INDEX shares_user_id_idx ON public.shares(user_id);
GRANT SELECT, INSERT ON public.shares TO authenticated;
GRANT SELECT ON public.shares TO anon;
GRANT ALL ON public.shares TO service_role;
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shares readable by anyone" ON public.shares FOR SELECT USING (true);
CREATE POLICY "users insert own shares" ON public.shares FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- favorites
CREATE TABLE public.favorites (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own favorites" ON public.favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users add own favorites" ON public.favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users remove own favorites" ON public.favorites FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- reposts
CREATE TABLE public.reposts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);
GRANT SELECT, INSERT, DELETE ON public.reposts TO authenticated;
GRANT SELECT ON public.reposts TO anon;
GRANT ALL ON public.reposts TO service_role;
ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reposts readable by anyone" ON public.reposts FOR SELECT USING (true);
CREATE POLICY "users add own reposts" ON public.reposts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users remove own reposts" ON public.reposts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- not_interested
CREATE TABLE public.not_interested (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);
GRANT SELECT, INSERT, DELETE ON public.not_interested TO authenticated;
GRANT ALL ON public.not_interested TO service_role;
ALTER TABLE public.not_interested ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own not_interested" ON public.not_interested FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users add own not_interested" ON public.not_interested FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users remove own not_interested" ON public.not_interested FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- reports
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reports_video_id_idx ON public.reports(video_id);
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own reports" ON public.reports FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own reports" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- realtime for share counts
ALTER PUBLICATION supabase_realtime ADD TABLE public.shares;
