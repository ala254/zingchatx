import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RtcTokenBuilder, RtcRole } from "agora-token";

export const getAgoraToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { channel: string; uid: number; role: "host" | "audience" }) => {
    if (!input || typeof input.channel !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(input.channel)) {
      throw new Error("invalid channel");
    }
    if (typeof input.uid !== "number" || !Number.isFinite(input.uid) || input.uid < 0 || input.uid > 4294967295) {
      throw new Error("invalid uid");
    }
    if (input.role !== "host" && input.role !== "audience") throw new Error("invalid role");
    return input;
  })
  .handler(async ({ data }) => {
    const appId = process.env.AGORA_APP_ID;
    const appCert = process.env.AGORA_APP_CERTIFICATE;
    if (!appId || !appCert) throw new Error("Agora credentials not configured");
    const expireSeconds = 60 * 60 * 4; // 4 hours
    const privilegeExpireTs = Math.floor(Date.now() / 1000) + expireSeconds;
    const role = data.role === "host" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCert,
      data.channel,
      data.uid,
      role,
      privilegeExpireTs,
      privilegeExpireTs,
    );
    return { token, appId, uid: data.uid, channel: data.channel, expiresAt: privilegeExpireTs };
  });
