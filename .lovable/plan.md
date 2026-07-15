
# ZingChatX Live — implementation plan

This is a large feature. I'll ship it across turns but front-load everything that doesn't need external credentials so the app is usable end-to-end even before Agora/Stripe are wired.

## What you'll need to provide

1. **Agora credentials** — I'll ask via the secure secret form after the DB is in place:
   - `AGORA_APP_ID` (publishable, but stored server-side anyway)
   - `AGORA_APP_CERTIFICATE` (secret — required for token auth)
   Get from https://console.agora.io → Project Management → new project with "Secured mode: APP ID + Token".
2. **Stripe** — I'll trigger the built-in Stripe payments enable flow; you fill in the form. Coin packs are digital goods, full-compliance handling default.
3. **Icons for gifts** — I'll seed a small default catalog (Rose, Heart, Rocket, Crown, Diamond) with emoji glyphs; swap art later.

## Phase 1 — DB + entry points + Live tab (this turn)

Database migration:
- `live_streams` (id, host_id, agora_channel, title, thumbnail_url, status: scheduled/live/ended, started_at, ended_at, viewer_peak, viewer_count, likes_count, gifts_total_coins)
- `live_viewers` (stream_id, user_id, joined_at, left_at) — for viewer count + presence
- `live_comments` (id, stream_id, user_id, content, is_pinned, created_at) — realtime
- `live_hearts` (stream_id, user_id, count, created_at) — batched heart taps
- `live_moderators` (stream_id, user_id)
- `live_bans` (stream_id, user_id) — moderator mute/block
- `live_reports` (id, stream_id, reported_user_id, reason)
- `coin_packs` (id, coins, price_cents, stripe_price_id)
- `gifts_catalog` (id, name, glyph, coin_cost, animation)
- `gift_sends` (id, stream_id, sender_id, host_id, gift_id, quantity, coin_total, created_at)
- `wallets` (user_id, coin_balance, earned_coins)
- `wallet_ledger` (id, user_id, delta_coins, kind: purchase/gift_sent/gift_received/withdrawal, ref_id)
- `withdrawal_requests` (id, user_id, coins, amount_cents, status, created_at)
- `live_notifications` (id, follower_id, host_id, stream_id, read_at) — in-app push
- Realtime enabled on `live_streams`, `live_comments`, `live_hearts`, `live_viewers`, `gift_sends`, `wallets`
- RLS + GRANTs on every table
- RPCs: `send_gift(stream_id, gift_id, qty)` (atomic wallet debit + host credit + insert), `record_heart_batch`, `end_live(stream_id)`, `join_live`/`leave_live`

UI additions:
- **"Go Live" button** on the create screen next to Upload Video
- **Live tab** in home feed (new route `/live` with grid of currently-live streams)
- **Live ring** row at top of `/feed` (currently-live followed creators, gradient ring around avatar) — taps into viewer

## Phase 2 — Broadcaster + viewer (same turn if space, else next)

- `/live/host` route: full-screen camera preview, front/back switch, beauty toggle (CSS filter overlay reused from ZingCam), title input, "Go Live" button → creates `live_streams` row, mints Agora RTC token via `startLive` server fn, joins channel as host
- `/live/$streamId` viewer route: joins as audience, renders remote video, comment stream, hearts overlay, viewer count, follow button, share, gift drawer, more menu (report / block)
- Realtime subscriptions for comments/hearts/viewers/gifts
- End-live confirmation dialog → calls `end_live` RPC, shows analytics summary (peak viewers, likes, coins earned, duration)
- Host controls: pin comment, mute/block viewer, add moderator by username
- Moderator controls: mute/block/pin (same actions, gated by `live_moderators` membership)

## Phase 3 — Monetization + push

- Enable Stripe payments (built-in). Seed coin packs (100 / 500 / 1,200 / 3,000 coins) as Stripe products.
- Coin purchase flow: server fn creates checkout session → webhook (server route `/api/public/webhooks/stripe`) credits wallet on `checkout.session.completed`
- Wallet page: balance, ledger, "Withdraw" (creates a `withdrawal_requests` row — manual payout, no Stripe Connect this pass)
- Gift drawer during live: select gift + qty, calls `send_gift` RPC, triggers full-screen animation for everyone via realtime
- **In-app push**: DB trigger on `live_streams` insert (status=live) fans out `live_notifications` to every follower; existing notifications page + realtime toast picks them up

## Phase 4 — History + analytics

- Profile → "Live history" tab: list of past streams with peak viewers / duration / coins earned / likes
- Per-stream analytics detail page

## Technical notes

- Agora token server: `createServerFn` `getAgoraToken({channel, uid, role})` using `agora-token` npm package (pure JS, Worker-safe). Read `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` inside the handler.
- Client SDK: `agora-rtc-sdk-ng` (browser only; dynamic import inside client-only components — no SSR reachability)
- Beauty filter: CSS `filter: contrast() saturate() brightness()` on `<video>` plus a canvas passthrough track for MediaStreamTrack processor when supported; falls back to visual overlay
- Hearts: batched every 500ms into `live_hearts` to keep DB writes sane; realtime channel broadcasts raw taps for animation
- `send_gift` runs in a SECURITY DEFINER function with `FOR UPDATE` on `wallets` to prevent race conditions
- Stripe managed_payments for coin packs (digital goods)

## Order of operations

1. Migration (Phase 1 schema, RLS, RPCs, realtime)
2. Ask for Agora secrets
3. Install `agora-rtc-sdk-ng` + `agora-token`
4. Ship UI: Live tab, Go Live entry, host route, viewer route, gift drawer, end-live dialog
5. Trigger `enable_stripe_payments`
6. Seed coin packs, add checkout + webhook + wallet UI
7. Add live history + analytics views

Approve to start.
