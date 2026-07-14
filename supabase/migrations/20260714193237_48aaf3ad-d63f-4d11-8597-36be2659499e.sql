
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_messages_from text NOT NULL DEFAULT 'everyone'
    CHECK (allow_messages_from IN ('everyone','followers','none')),
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en'
    CHECK (language IN ('en','ha')),
  ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_likes boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_comments boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_follows boolean NOT NULL DEFAULT true;
