import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin-only controls for one student's course enrollment. */
export const updateStudentCourseAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      enrollmentId: z.string().uuid(),
      action: z.enum(["set_expiry", "extend", "suspend", "activate"]),
      expiresAt: z.string().datetime().optional(),
      days: z.number().int().min(1).max(3650).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !isAdmin) throw new Error("Only the institute admin can change course access.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: enrollment, error: readError } = await supabaseAdmin
      .from("enrollments")
      .select("id, user_id, course_id, status, expires_at")
      .eq("id", data.enrollmentId)
      .maybeSingle();
    if (readError) throw readError;
    if (!enrollment) throw new Error("Student enrollment not found.");

    const update: { status?: string; expires_at?: string } = {};
    if (data.action === "suspend") update.status = "suspended";
    if (data.action === "activate") update.status = "active";
    if (data.action === "set_expiry") {
      if (!data.expiresAt || !Number.isFinite(Date.parse(data.expiresAt)) || Date.parse(data.expiresAt) <= Date.now()) {
        throw new Error("Choose a future expiry date.");
      }
      update.expires_at = new Date(data.expiresAt).toISOString();
      update.status = "active";
    }
    if (data.action === "extend") {
      if (!data.days) throw new Error("Enter how many days to extend.");
      const current = enrollment.expires_at ? new Date(enrollment.expires_at).getTime() : Date.now();
      const base = Math.max(current, Date.now());
      update.expires_at = new Date(base + data.days * 86400000).toISOString();
      update.status = "active";
    }

    const { data: saved, error: saveError } = await supabaseAdmin
      .from("enrollments")
      .update(update)
      .eq("id", enrollment.id)
      .select("id, status, expires_at")
      .single();
    if (saveError) throw saveError;

    const { data: course } = await supabaseAdmin.from("courses").select("title").eq("id", enrollment.course_id).maybeSingle();
    const title = course?.title ?? "your course";
    const body = data.action === "suspend"
      ? `Access to "${title}" has been paused by the institute. Contact the admin if you think this is a mistake.`
      : data.action === "activate"
        ? `Access to "${title}" has been turned on again. Check your course page for the expiry date.`
        : `Your access to "${title}" has been updated. New expiry: ${new Date(saved.expires_at!).toLocaleDateString("en-IN")}.`;
    await supabaseAdmin.from("notifications").insert({
      user_id: enrollment.user_id,
      title: data.action === "suspend" ? "Course access paused" : "Course access updated",
      body,
      type: "enrollment",
      link: "/courses",
    });

    return { ok: true as const, enrollment: saved };
  });
