
-- =========================================================
-- ZingChatX Live Streaming — Phase 1 schema
-- =========================================================

CREATE TYPE public.live_status AS ENUM ('scheduled', 'live', 'ended');
CREATE TYPE public.ledger_kind AS ENUM ('purchase', 'gift_sent', 'gift_received', 'withdrawal', 'adjustment');
CREATE TYPE public.withdrawal_status AS ENUM ('pending', 'approved', 'rejected', 'paid');

-- ---------- live_streams ----------
CREATE TABLE public.live_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agora_channel text NOT NULL UNIQUE,
  title text,
  thumbnail_url text,
  status public.live_status NOT NULL DEFAULT 'live',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  viewer_count integer NOT NULL DEFAULT 0,
  viewer_peak integer NOT NULL DEFAULT 0,
  likes_count integer NOT NULL DEFAULT 0,
  gifts_total_coins integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_live_streams_status ON public.live_streams(status, started_at DESC);
CREATE INDEX idx_live_streams_host ON public.live_streams(host_id, started_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_streams TO authenticated;
GRANT ALL ON public.live_streams TO service_role;
ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view streams" ON public.live_streams
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Host creates own stream" ON public.live_streams
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Host updates own stream" ON public.live_streams
  FOR UPDATE TO authenticated USING (auth.uid() = host_id);
CREATE POLICY "Host deletes own stream" ON public.live_streams
  FOR DELETE TO authenticated USING (auth.uid() = host_id);

-- ---------- live_viewers ----------
CREATE TABLE public.live_viewers (
  stream_id uuid NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  PRIMARY KEY (stream_id, user_id)
);
CREATE INDEX idx_live_viewers_stream ON public.live_viewers(stream_id) WHERE left_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_viewers TO authenticated;
GRANT ALL ON public.live_viewers TO service_role;
ALTER TABLE public.live_viewers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in views viewer rows" ON public.live_viewers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "User inserts own viewer row" ON public.live_viewers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User updates own viewer row" ON public.live_viewers
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ---------- live_moderators ----------
CREATE TABLE public.live_moderators (
  stream_id uuid NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (stream_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_moderators TO authenticated;
GRANT ALL ON public.live_moderators TO service_role;
ALTER TABLE public.live_moderators ENABLE ROW LEVEL SECURITY;

-- helper: is host or mod (SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_live_staff(_stream_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.live_streams WHERE id = _stream_id AND host_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.live_moderators WHERE stream_id = _stream_id AND user_id = _user_id)
$$;

CREATE POLICY "Anyone signed in views mods" ON public.live_moderators
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Host manages mods" ON public.live_moderators
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.live_streams s WHERE s.id = stream_id AND s.host_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.live_streams s WHERE s.id = stream_id AND s.host_id = auth.uid()));

-- ---------- live_bans ----------
CREATE TABLE public.live_bans (
  stream_id uuid NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (stream_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_bans TO authenticated;
GRANT ALL ON public.live_bans TO service_role;
ALTER TABLE public.live_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff views bans" ON public.live_bans
  FOR SELECT TO authenticated USING (public.is_live_staff(stream_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Staff manages bans" ON public.live_bans
  FOR ALL TO authenticated
  USING (public.is_live_staff(stream_id, auth.uid()))
  WITH CHECK (public.is_live_staff(stream_id, auth.uid()));

-- ---------- live_comments ----------
CREATE TABLE public.live_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_live_comments_stream ON public.live_comments(stream_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_comments TO authenticated;
GRANT ALL ON public.live_comments TO service_role;
ALTER TABLE public.live_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in reads comments" ON public.live_comments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed in posts comment when not banned" ON public.live_comments
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (SELECT 1 FROM public.live_bans b WHERE b.stream_id = stream_id AND b.user_id = auth.uid())
  );
CREATE POLICY "Author or staff updates comment" ON public.live_comments
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_live_staff(stream_id, auth.uid()));
CREATE POLICY "Author or staff deletes comment" ON public.live_comments
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_live_staff(stream_id, auth.uid()));

-- ---------- live_hearts ----------
CREATE TABLE public.live_hearts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  count integer NOT NULL DEFAULT 1 CHECK (count > 0 AND count <= 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_live_hearts_stream ON public.live_hearts(stream_id, created_at DESC);
GRANT SELECT, INSERT ON public.live_hearts TO authenticated;
GRANT ALL ON public.live_hearts TO service_role;
ALTER TABLE public.live_hearts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads hearts" ON public.live_hearts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed in sends hearts" ON public.live_hearts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ---------- live_reports ----------
CREATE TABLE public.live_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.live_reports TO authenticated;
GRANT ALL ON public.live_reports TO service_role;
ALTER TABLE public.live_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporter reads own reports" ON public.live_reports
  FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
CREATE POLICY "Signed in files reports" ON public.live_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

-- ---------- coin_packs ----------
CREATE TABLE public.coin_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coins integer NOT NULL,
  price_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  stripe_price_id text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coin_packs TO authenticated, anon;
GRANT ALL ON public.coin_packs TO service_role;
ALTER TABLE public.coin_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads active packs" ON public.coin_packs
  FOR SELECT TO authenticated, anon USING (is_active = true);

INSERT INTO public.coin_packs (coins, price_cents, sort_order) VALUES
  (100, 99, 1), (500, 499, 2), (1200, 999, 3), (3000, 2499, 4);

-- ---------- gifts_catalog ----------
CREATE TABLE public.gifts_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  glyph text NOT NULL,
  coin_cost integer NOT NULL,
  animation text NOT NULL DEFAULT 'float',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gifts_catalog TO authenticated, anon;
GRANT ALL ON public.gifts_catalog TO service_role;
ALTER TABLE public.gifts_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads active gifts" ON public.gifts_catalog
  FOR SELECT TO authenticated, anon USING (is_active = true);

INSERT INTO public.gifts_catalog (name, glyph, coin_cost, animation, sort_order) VALUES
  ('Rose', '🌹', 1, 'float', 1),
  ('Heart', '💖', 5, 'float', 2),
  ('Rocket', '🚀', 50, 'burst', 3),
  ('Crown', '👑', 200, 'shine', 4),
  ('Diamond', '💎', 1000, 'burst', 5);

-- ---------- wallets ----------
CREATE TABLE public.wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  coin_balance integer NOT NULL DEFAULT 0 CHECK (coin_balance >= 0),
  earned_coins integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads wallet" ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owner insert wallet" ON public.wallets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ---------- wallet_ledger ----------
CREATE TABLE public.wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta_coins integer NOT NULL,
  kind public.ledger_kind NOT NULL,
  ref_id uuid,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wallet_ledger_user ON public.wallet_ledger(user_id, created_at DESC);
GRANT SELECT ON public.wallet_ledger TO authenticated;
GRANT ALL ON public.wallet_ledger TO service_role;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads ledger" ON public.wallet_ledger FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ---------- gift_sends ----------
CREATE TABLE public.gift_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gift_id uuid NOT NULL REFERENCES public.gifts_catalog(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  coin_total integer NOT NULL CHECK (coin_total > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_gift_sends_stream ON public.gift_sends(stream_id, created_at DESC);
GRANT SELECT ON public.gift_sends TO authenticated;
GRANT ALL ON public.gift_sends TO service_role;
ALTER TABLE public.gift_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in reads gifts" ON public.gift_sends
  FOR SELECT TO authenticated USING (true);

-- ---------- withdrawal_requests ----------
CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coins integer NOT NULL CHECK (coins > 0),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'usd',
  method text,
  destination text,
  status public.withdrawal_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
GRANT SELECT, INSERT ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads withdrawals" ON public.withdrawal_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owner creates withdrawal" ON public.withdrawal_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ---------- live_notifications ----------
CREATE TABLE public.live_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stream_id uuid NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_live_notif_follower ON public.live_notifications(follower_id, created_at DESC);
GRANT SELECT, UPDATE ON public.live_notifications TO authenticated;
GRANT ALL ON public.live_notifications TO service_role;
ALTER TABLE public.live_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Follower reads own notifs" ON public.live_notifications FOR SELECT TO authenticated USING (auth.uid() = follower_id);
CREATE POLICY "Follower marks own notif" ON public.live_notifications FOR UPDATE TO authenticated USING (auth.uid() = follower_id);

-- =========================================================
-- Functions
-- =========================================================

-- updated_at trigger for live_streams / wallets
CREATE TRIGGER trg_live_streams_updated BEFORE UPDATE ON public.live_streams
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_wallets_updated BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ensure wallet row exists for a user
CREATE OR REPLACE FUNCTION public.ensure_wallet(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.wallets (user_id) VALUES (_user_id) ON CONFLICT DO NOTHING;
END;
$$;

-- join a live stream (increment counts, presence row)
CREATE OR REPLACE FUNCTION public.join_live(_stream_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.live_bans WHERE stream_id = _stream_id AND user_id = uid) THEN
    RAISE EXCEPTION 'banned';
  END IF;
  INSERT INTO public.live_viewers (stream_id, user_id)
    VALUES (_stream_id, uid)
    ON CONFLICT (stream_id, user_id) DO UPDATE SET joined_at = now(), left_at = NULL;
  UPDATE public.live_streams
     SET viewer_count = (SELECT COUNT(*) FROM public.live_viewers WHERE stream_id = _stream_id AND left_at IS NULL),
         viewer_peak = GREATEST(viewer_peak, (SELECT COUNT(*) FROM public.live_viewers WHERE stream_id = _stream_id AND left_at IS NULL))
   WHERE id = _stream_id;
END;
$$;

-- leave a live stream
CREATE OR REPLACE FUNCTION public.leave_live(_stream_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  UPDATE public.live_viewers SET left_at = now() WHERE stream_id = _stream_id AND user_id = uid AND left_at IS NULL;
  UPDATE public.live_streams
     SET viewer_count = (SELECT COUNT(*) FROM public.live_viewers WHERE stream_id = _stream_id AND left_at IS NULL)
   WHERE id = _stream_id;
END;
$$;

-- record a heart tap batch
CREATE OR REPLACE FUNCTION public.record_heart_batch(_stream_id uuid, _count integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  n integer := LEAST(GREATEST(_count, 1), 200);
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.live_bans WHERE stream_id = _stream_id AND user_id = uid) THEN
    RAISE EXCEPTION 'banned';
  END IF;
  INSERT INTO public.live_hearts (stream_id, user_id, count) VALUES (_stream_id, uid, n);
  UPDATE public.live_streams SET likes_count = likes_count + n WHERE id = _stream_id;
END;
$$;

-- send a gift atomically
CREATE OR REPLACE FUNCTION public.send_gift(_stream_id uuid, _gift_id uuid, _quantity integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  v_host uuid;
  v_cost integer;
  v_total integer;
  v_bal integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _quantity IS NULL OR _quantity < 1 OR _quantity > 999 THEN RAISE EXCEPTION 'invalid quantity'; END IF;

  SELECT host_id INTO v_host FROM public.live_streams WHERE id = _stream_id AND status = 'live';
  IF v_host IS NULL THEN RAISE EXCEPTION 'stream not live'; END IF;
  IF v_host = uid THEN RAISE EXCEPTION 'cannot gift self'; END IF;

  SELECT coin_cost INTO v_cost FROM public.gifts_catalog WHERE id = _gift_id AND is_active;
  IF v_cost IS NULL THEN RAISE EXCEPTION 'gift not found'; END IF;
  v_total := v_cost * _quantity;

  PERFORM public.ensure_wallet(uid);
  PERFORM public.ensure_wallet(v_host);

  -- lock sender wallet
  SELECT coin_balance INTO v_bal FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF v_bal < v_total THEN RAISE EXCEPTION 'insufficient coins'; END IF;

  UPDATE public.wallets SET coin_balance = coin_balance - v_total WHERE user_id = uid;
  UPDATE public.wallets SET coin_balance = coin_balance + v_total, earned_coins = earned_coins + v_total WHERE user_id = v_host;

  INSERT INTO public.gift_sends (stream_id, sender_id, host_id, gift_id, quantity, coin_total)
    VALUES (_stream_id, uid, v_host, _gift_id, _quantity, v_total)
    RETURNING id INTO v_bal; -- reuse var

  INSERT INTO public.wallet_ledger (user_id, delta_coins, kind, ref_id, memo)
    VALUES (uid, -v_total, 'gift_sent', v_bal, 'Gift sent'),
           (v_host, v_total, 'gift_received', v_bal, 'Gift received');

  UPDATE public.live_streams SET gifts_total_coins = gifts_total_coins + v_total WHERE id = _stream_id;

  RETURN jsonb_build_object('ok', true, 'coin_total', v_total);
END;
$$;

-- end a live
CREATE OR REPLACE FUNCTION public.end_live(_stream_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.live_streams WHERE id = _stream_id AND host_id = uid) THEN
    RAISE EXCEPTION 'not host';
  END IF;
  UPDATE public.live_streams SET status = 'ended', ended_at = now() WHERE id = _stream_id;
  UPDATE public.live_viewers SET left_at = now() WHERE stream_id = _stream_id AND left_at IS NULL;
END;
$$;

-- fan out "went live" notifications to followers
CREATE OR REPLACE FUNCTION public.notify_followers_of_live()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'live' THEN
    INSERT INTO public.live_notifications (follower_id, host_id, stream_id)
    SELECT f.follower_id, NEW.host_id, NEW.id
    FROM public.follows f
    WHERE f.following_id = NEW.host_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_live AFTER INSERT ON public.live_streams
  FOR EACH ROW EXECUTE FUNCTION public.notify_followers_of_live();

-- =========================================================
-- Realtime
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_streams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_hearts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_viewers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gift_sends;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_notifications;
