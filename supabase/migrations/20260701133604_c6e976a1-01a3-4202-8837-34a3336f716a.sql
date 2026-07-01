
-- Verified badge on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;

-- Helpful indexes for follow/social lookups
CREATE INDEX IF NOT EXISTS follows_following_id_idx ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS follows_follower_id_idx ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS videos_user_id_idx ON public.videos(user_id);
CREATE INDEX IF NOT EXISTS likes_video_id_idx ON public.likes(video_id);
CREATE INDEX IF NOT EXISTS likes_user_id_idx ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS profiles_username_lower_idx ON public.profiles(lower(username));

-- Enable Realtime broadcasts for social tables (idempotent)
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.follows  REPLICA IDENTITY FULL;
