import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(userId: string, supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Only the institute admin can control a live class.");
  return true;
}

async function getRecipients(supabaseAdmin: SupabaseClient<Database>, liveClass: { batch_id: string | null; course_id: string | null }) {
  const now = new Date().toISOString();
  let query = supabaseAdmin.from("enrollments").select("user_id").eq("status", "active").or("expires_at.gt." + now + ",expires_at.is.null");
  if (liveClass.batch_id) query = query.eq("batch_id", liveClass.batch_id);
  else if (liveClass.course_id) query = query.eq("course_id", liveClass.course_id);
  const { data, error } = await query;
  if (error) throw error;
  return [...new Set((data ?? []).map((row: { user_id: string }) => row.user_id))] as string[];
}

export const startLiveClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ liveClassId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: liveClass, error } = await supabaseAdmin
      .from("live_classes")
      .select("id, title, course_id, batch_id, live_status")
      .eq("id", data.liveClassId)
      .maybeSingle();
    if (error) throw error;
    if (!liveClass) throw new Error("Live class not found.");
    if (liveClass.live_status === "live") throw new Error("This class is already live.");
    if (!process.env["LIVEKIT_URL"] || !process.env["LIVEKIT_API_KEY"] || !process.env["LIVEKIT_API_SECRET"]) {
      throw new Error("Live video is not connected yet. Add LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET in Lovable Secrets first.");
    }

    const roomName = `jk-academy-${liveClass.id}`;
    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin.from("live_classes")
      .update({ live_status: "live", room_name: roomName, started_at: now, ended_at: null })
      .eq("id", liveClass.id);
    if (updateError) throw updateError;

    const recipients = await getRecipients(supabaseAdmin, liveClass);
    if (recipients.length) {
      const { error: notifyError } = await supabaseAdmin.from("notifications").insert(
        recipients.map((userId) => ({
          user_id: userId,
          title: "JK Academy live class is now LIVE",
          body: `${liveClass.title} has started. Open the Live tab to watch and ask questions.`,
          type: "live",
          link: "/live",
        })),
      );
      if (notifyError) throw notifyError;
    }
    return { ok: true as const, roomName };
  });

export const endLiveClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ liveClassId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("live_classes")
      .update({ live_status: "ended", ended_at: new Date().toISOString() })
      .eq("id", data.liveClassId);
    if (error) throw error;
    return { ok: true as const };
  });

export const getLiveClassToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ liveClassId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw roleError;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: liveClass, error } = await supabaseAdmin.from("live_classes")
      .select("id, title, course_id, batch_id, live_status, room_name")
      .eq("id", data.liveClassId)
      .maybeSingle();
    if (error) throw error;
    if (!liveClass || liveClass.live_status !== "live") throw new Error("This live class is not currently running.");

    if (!isAdmin) {
      if (liveClass.batch_id) {
        const { data: enrollment, error: enrollmentError } = await context.supabase.from("enrollments")
          .select("id")
          .eq("user_id", context.userId)
          .eq("batch_id", liveClass.batch_id)
          .eq("status", "active")
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();
        if (enrollmentError) throw enrollmentError;
        if (!enrollment) throw new Error("This live class is only for students with active access to its batch.");
      } else if (liveClass.course_id) {
        const { data: hasAccess, error: accessError } = await context.supabase.rpc("has_active_course_access", {
          _user_id: context.userId,
          _course_id: liveClass.course_id,
        });
        if (accessError) throw accessError;
        if (!hasAccess) throw new Error("Your course access has expired or is paused.");
      }
    }

    const serverUrl = process.env["LIVEKIT_URL"];
    const apiKey = process.env["LIVEKIT_API_KEY"];
    const apiSecret = process.env["LIVEKIT_API_SECRET"];
    if (!serverUrl || !apiKey || !apiSecret) {
      throw new Error("Live video is not connected yet. The admin must add the LiveKit connection in Lovable Secrets.");
    }

    const { AccessToken } = await import("livekit-server-sdk");
    const roomName = liveClass.room_name || `jk-academy-${liveClass.id}`;
    const token = new AccessToken(apiKey, apiSecret, {
      identity: context.userId,
      name: context.userId,
      ttl: "2h",
    });
    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: !!isAdmin,
      canPublishData: false,
      canSubscribe: true,
    });
    return {
      serverUrl,
      participantToken: await token.toJwt(),
      canPublish: !!isAdmin,
      roomName,
    };
  });
