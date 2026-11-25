import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const requestVideoPdf = createServerFn({ method: "POST" })
  .inputValidator((data: { lessonId: string; action: "auto" | "manual" }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: adminRole, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError || !adminRole) return { ok: false as const, error: "Admin access required." };

    const geminiKey = process.env["GEMINI_API_KEY"];
    const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    const supabaseUrl = process.env["SUPABASE_URL"];
    if (!geminiKey) return { ok: false as const, error: "GEMINI_API_KEY is not configured on the app server." };
    if (!serviceKey || !supabaseUrl) return { ok: false as const, error: "Supabase server configuration is missing." };

    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/video-to-pdf`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lessonId: data.lessonId,
        action: data.action,
        requestedBy: userId,
        geminiKey,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false as const, error: result.error || `Video-to-PDF service failed (${response.status}).` };
    }
    return { ok: true as const, ...result };
  });
