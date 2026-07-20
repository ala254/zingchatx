import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Create a Stripe Checkout session for a coin pack.
 * Returns { url } on success or { message } if Stripe is not yet enabled.
 * When Stripe Payments is enabled in Lovable, STRIPE_SECRET_KEY is injected.
 */
export const createCoinCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { packId: string }) => {
    if (!input?.packId || typeof input.packId !== "string") throw new Error("invalid packId");
    return input;
  })
  .handler(async ({ data, context }) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return {
        url: null as string | null,
        message: "Coin purchases will be available once Stripe Payments is enabled.",
      };
    }

    // Load pack from DB (auth'd client, RLS-safe for public.coin_packs)
    const { data: pack, error } = await context.supabase
      .from("coin_packs")
      .select("*")
      .eq("id", data.packId)
      .eq("is_active", true)
      .maybeSingle();
    if (error || !pack) throw new Error("Pack not found");

    // Build absolute base URL from request
    const origin = process.env.APP_ORIGIN ?? "";

    const form = new URLSearchParams();
    form.append("mode", "payment");
    form.append("success_url", `${origin}/wallet?purchase=success`);
    form.append("cancel_url", `${origin}/wallet?purchase=cancel`);
    form.append("client_reference_id", context.userId);
    form.append("metadata[user_id]", context.userId);
    form.append("metadata[pack_id]", pack.id);
    form.append("metadata[coins]", String(pack.coins));

    if (pack.stripe_price_id) {
      form.append("line_items[0][price]", pack.stripe_price_id);
      form.append("line_items[0][quantity]", "1");
    } else {
      form.append("line_items[0][price_data][currency]", pack.currency ?? "usd");
      form.append("line_items[0][price_data][product_data][name]", `${pack.coins} ZingChatX coins`);
      form.append("line_items[0][price_data][unit_amount]", String(pack.price_cents));
      form.append("line_items[0][quantity]", "1");
    }

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("Stripe error", res.status, t);
      throw new Error("Stripe checkout failed");
    }
    const session = (await res.json()) as { url: string };
    return { url: session.url, message: null as string | null };
  });
