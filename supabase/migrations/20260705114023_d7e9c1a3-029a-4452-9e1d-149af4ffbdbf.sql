
-- Restrict shares SELECT to owner; expose aggregate share counts via a security-definer RPC
DROP POLICY IF EXISTS "shares readable by anyone" ON public.shares;
CREATE POLICY "Users read own shares" ON public.shares FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_share_counts(video_ids uuid[])
RETURNS TABLE(video_id uuid, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT video_id, COUNT(*)::bigint
  FROM public.shares
  WHERE video_id = ANY(video_ids)
  GROUP BY video_id
$$;

REVOKE ALL ON FUNCTION public.get_share_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_share_counts(uuid[]) TO anon, authenticated;
