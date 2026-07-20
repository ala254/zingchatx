import { createFileRoute } from "@tanstack/react-router";

/**
 * Stripe webhook — credits the buyer's wallet when a coin-pack checkout completes.
 * Public route: bypasses site auth, but we verify the Stripe signature manually.
 */
export const Route = createFileRoute("/api/public/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!secret || !stripeKey) return new Response("stripe not configured", { status: 503 });

        const rawBody = await request.text();
        const sigHeader = request.headers.get("stripe-signature") ?? "";
        const ok = await verifyStripeSignature(rawBody, sigHeader, secret);
        if (!ok) return new Response("invalid signature", { status: 401 });

        let event: any;
        try {
          event = JSON.parse(rawBody);
        } catch {
          return new Response("bad body", { status: 400 });
        }

        if (event.type !== "checkout.session.completed") return new Response("ignored", { status: 200 });

        const session = event.data?.object ?? {};
        const userId: string | undefined = session.metadata?.user_id ?? session.client_reference_id;
        const coins = Number(session.metadata?.coins ?? 0);
        const packId: string | undefined = session.metadata?.pack_id;
        if (!userId || !coins) return new Response("missing metadata", { status: 200 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Idempotency: check ledger for this session
        const sessionId: string = session.id;
        const { data: existing } = await supabaseAdmin
          .from("wallet_ledger")
          .select("id")
          .eq("kind", "purchase")
          .eq("memo", sessionId)
          .maybeSingle();
        if (existing) return new Response("already credited", { status: 200 });

        // Ensure wallet, credit balance, insert ledger
        await supabaseAdmin.from("wallets").upsert({ user_id: userId }, { onConflict: "user_id" });
        const { data: w } = await supabaseAdmin.from("wallets").select("coin_balance").eq("user_id", userId).maybeSingle();
        const newBal = (w?.coin_balance ?? 0) + coins;
        await supabaseAdmin.from("wallets").update({ coin_balance: newBal }).eq("user_id", userId);
        await supabaseAdmin.from("wallet_ledger").insert({
          user_id: userId,
          delta_coins: coins,
          kind: "purchase",
          ref_id: null,
          memo: sessionId,
        });

        return new Response("ok", { status: 200 });
      },
    },
  },
});

// Manual Stripe signature verification (Cloudflare Workers-safe, no Node crypto module)
async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  try {
    const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=")));
    const t = parts.t;
    const v1 = parts.v1;
    if (!t || !v1) return false;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`));
    const sigHex = Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    // constant time compare
    if (sigHex.length !== v1.length) return false;
    let diff = 0;
    for (let i = 0; i < sigHex.length; i++) diff |= sigHex.charCodeAt(i) ^ v1.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}
