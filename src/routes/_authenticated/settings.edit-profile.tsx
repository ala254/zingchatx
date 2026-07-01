import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, Camera } from "lucide-react";
import { toast } from "sonner";
import { Route as AuthRoute } from "../_authenticated/route";
import { UserAvatar } from "@/components/user-avatar";
import { compressAvatar } from "@/lib/image";

export const Route = createFileRoute("/_authenticated/settings/edit-profile")({
  head: () => ({ meta: [{ title: "Edit profile — ZingChatX" }] }),
  component: EditProfilePage,
});

function EditProfilePage() {
  const { user } = AuthRoute.useRouteContext();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("profiles").select("*").eq("id", user!.id).single().then(({ data }) => {
      if (!data) return;
      setUsername(data.username ?? "");
      setDisplayName(data.display_name ?? "");
      setBio(data.bio ?? "");
      setAvatarUrl(data.avatar_url ?? null);
    });
  }, [user]);

  async function handleAvatar(file: File | undefined | null) {
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) return toast.error("Pick an image");
    if (file.size > 10 * 1024 * 1024) return toast.error("Max 10 MB");
    setUploading(true);
    try {
      const blob = await compressAvatar(file);
      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
      setAvatarUrl(path); // store storage path; signed at render time
      toast.success("Photo updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!user) return;
    if (!/^[a-z0-9_]{3,20}$/i.test(username)) return toast.error("Username must be 3-20 chars, letters/numbers/_");
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      username: username.toLowerCase(),
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
      avatar_url: avatarUrl,
    }).eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    navigate({ to: "/profile" });
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-4 pb-8">
      <div className="flex items-center gap-2">
        <Link to="/settings" className="rounded-full p-2 hover:bg-surface"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="font-display text-xl font-bold">Edit profile</h1>
      </div>

      <div className="mt-6 flex flex-col items-center">
        <button onClick={() => fileRef.current?.click()} className="relative">
          <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-border bg-surface">
            {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : (
              <div className="flex h-full w-full items-center justify-center font-display text-3xl text-gradient-zing font-bold">
                {(username[0] ?? "?").toUpperCase()}
              </div>
            )}
          </div>
          <div className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full gradient-zing shadow-zing">
            <Camera className="h-4 w-4 text-zing-foreground" />
          </div>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatar(e.target.files?.[0])} />
      </div>

      <div className="mt-6 space-y-3">
        <Field label="Username">
          <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm focus:border-primary focus:outline-none" />
        </Field>
        <Field label="Display name">
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm focus:border-primary focus:outline-none" />
        </Field>
        <Field label="Bio">
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={160} className="w-full resize-none rounded-xl border border-border bg-input px-4 py-3 text-sm focus:border-primary focus:outline-none" />
        </Field>
      </div>

      <button
        onClick={handleSave}
        disabled={busy}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full gradient-zing px-6 py-3 text-sm font-semibold text-zing-foreground shadow-zing disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Save changes
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
