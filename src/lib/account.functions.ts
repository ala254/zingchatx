import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Best-effort cleanup of storage objects owned by the user.
    for (const bucket of ["videos", "thumbnails", "avatars"] as const) {
      try {
        const { data: files } = await supabaseAdmin.storage.from(bucket).list(userId, { limit: 1000 });
        if (files?.length) {
          await supabaseAdmin.storage
            .from(bucket)
            .remove(files.map((f) => `${userId}/${f.name}`));
        }
      } catch (e) {
        console.error(`cleanup ${bucket} failed`, e);
      }
    }

    // Rows in videos/comments/likes/etc. cascade via FK ON DELETE CASCADE to auth.users.
    // Ensure the profile row (public.profiles) is removed too.
    await supabase.from("profiles").delete().eq("id", userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
