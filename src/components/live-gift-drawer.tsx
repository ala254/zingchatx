import { useEffect, useState } from "react";
import { X, Coins, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { fetchGifts, fetchWallet, sendGift, type Gift, type Wallet } from "@/lib/live";

export function LiveGiftDrawer({
  open,
  streamId,
  userId,
  onClose,
}: {
  open: boolean;
  streamId: string;
  userId: string;
  onClose: () => void;
}) {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchGifts().then(setGifts);
    fetchWallet(userId).then(setWallet);
  }, [open, userId]);

  async function handleSend(giftId: string) {
    setBusy(true);
    try {
      await sendGift(streamId, giftId, 1);
      toast.success("Gift sent!");
      const w = await fetchWallet(userId);
      setWallet(w);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send gift");
    } finally {
      setBusy(false);
      setSelected(null);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full rounded-t-3xl bg-surface p-4 pb-6 shadow-2xl animate-slide-in-right"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 1.5rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">Send a gift</h3>
          <button onClick={onClose} className="rounded-full bg-secondary p-1.5">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-4 flex items-center justify-between rounded-2xl bg-surface-elevated px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold">{wallet?.coin_balance ?? 0}</span>
            <span className="text-xs text-muted-foreground">coins</span>
          </div>
          <Link to="/wallet" className="text-xs font-semibold text-primary">Top up</Link>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {gifts.map((g) => (
            <button
              key={g.id}
              onClick={() => { setSelected(g.id); handleSend(g.id); }}
              disabled={busy}
              className={`flex flex-col items-center rounded-2xl border p-3 transition ${
                selected === g.id ? "border-primary bg-primary/10" : "border-border bg-surface-elevated"
              } disabled:opacity-60`}
            >
              <span className="text-3xl">{g.glyph}</span>
              <span className="mt-1 text-[10px] font-medium text-foreground">{g.name}</span>
              <span className="mt-0.5 flex items-center gap-0.5 text-[10px] text-amber-400">
                <Coins className="h-2.5 w-2.5" /> {g.coin_cost}
              </span>
            </button>
          ))}
        </div>
        {busy ? <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Sending…</div> : null}
      </div>
    </div>
  );
}
