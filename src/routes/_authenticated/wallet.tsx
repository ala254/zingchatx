import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Coins, ArrowLeft, Loader2, TrendingUp, Download } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Route as AuthRoute } from "../_authenticated/route";
import { fetchCoinPacks, fetchWallet, fetchWalletLedger, requestWithdrawal } from "@/lib/live";
import { createCoinCheckout } from "@/lib/coins.functions";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({ meta: [{ title: "Wallet — ZingChatX" }] }),
  component: WalletPage,
});

function WalletPage() {
  const { user } = AuthRoute.useRouteContext();
  const uid = user!.id;
  const checkout = useServerFn(createCoinCheckout);
  const [buying, setBuying] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");

  const { data: wallet } = useQuery({ queryKey: ["wallet", uid], queryFn: () => fetchWallet(uid), refetchInterval: 8_000 });
  const { data: packs = [] } = useQuery({ queryKey: ["coin-packs"], queryFn: fetchCoinPacks });
  const { data: ledger = [] } = useQuery({ queryKey: ["ledger", uid], queryFn: () => fetchWalletLedger(uid) });

  async function buy(packId: string) {
    setBuying(packId);
    try {
      const res = await checkout({ data: { packId } });
      if (res.url) window.location.href = res.url;
      else toast.info(res.message ?? "Coin purchases are not yet enabled. Ask your admin to enable Stripe Payments.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start checkout");
    } finally {
      setBuying(null);
    }
  }

  async function withdraw() {
    const n = Number(withdrawAmount);
    if (!Number.isFinite(n) || n < 1000) return toast.error("Minimum withdrawal: 1000 coins");
    if (!wallet || n > wallet.coin_balance) return toast.error("Not enough coins");
    setWithdrawing(true);
    try {
      await requestWithdrawal(uid, Math.floor(n));
      toast.success("Withdrawal requested");
      setWithdrawAmount("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-4">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/profile" className="rounded-full bg-surface-elevated p-2"><ArrowLeft className="h-4 w-4" /></Link>
        <h1 className="font-display text-xl font-bold">Wallet</h1>
      </div>

      <div className="rounded-3xl gradient-zing p-5 text-zing-foreground shadow-zing">
        <p className="text-xs opacity-90">Coin balance</p>
        <p className="mt-1 flex items-center gap-2 font-display text-4xl font-bold">
          <Coins className="h-8 w-8" /> {wallet?.coin_balance ?? 0}
        </p>
        <p className="mt-2 text-[11px] opacity-90 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Earned {wallet?.earned_coins ?? 0} lifetime</p>
      </div>

      <h2 className="mt-6 font-display font-semibold">Top up coins</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {packs.map((p) => (
          <button
            key={p.id}
            onClick={() => buy(p.id)}
            disabled={buying === p.id}
            className="rounded-2xl border border-border bg-surface-elevated p-4 text-left transition active:scale-[0.98] disabled:opacity-60"
          >
            <div className="flex items-center gap-1.5 font-display text-lg font-bold">
              <Coins className="h-4 w-4 text-amber-400" /> {p.coins.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {buying === p.id ? "Opening…" : `$${(p.price_cents / 100).toFixed(2)}`}
            </div>
          </button>
        ))}
      </div>

      <h2 className="mt-6 font-display font-semibold">Withdraw earnings</h2>
      <p className="mt-1 text-xs text-muted-foreground">100 coins = $1.00 · minimum 1,000 coins</p>
      <div className="mt-3 flex gap-2">
        <input
          type="number"
          value={withdrawAmount}
          onChange={(e) => setWithdrawAmount(e.target.value)}
          placeholder="Amount in coins"
          className="flex-1 rounded-2xl border border-border bg-input px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
        />
        <button
          onClick={withdraw}
          disabled={withdrawing}
          className="flex items-center gap-1.5 rounded-2xl gradient-zing px-4 py-2.5 text-sm font-semibold text-zing-foreground disabled:opacity-60"
        >
          {withdrawing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Request
        </button>
      </div>

      <h2 className="mt-6 font-display font-semibold">Recent activity</h2>
      <ul className="mt-2 divide-y divide-border/60 rounded-2xl border border-border bg-surface-elevated">
        {ledger.length === 0 ? (
          <li className="p-4 text-xs text-muted-foreground">No activity yet.</li>
        ) : (
          ledger.map((l: any) => (
            <li key={l.id} className="flex items-center justify-between p-3">
              <div>
                <p className="text-xs font-medium capitalize">{l.kind.replace("_", " ")}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(l.created_at).toLocaleString()}</p>
              </div>
              <span className={`text-sm font-semibold ${l.delta_coins >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {l.delta_coins >= 0 ? "+" : ""}{l.delta_coins}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
