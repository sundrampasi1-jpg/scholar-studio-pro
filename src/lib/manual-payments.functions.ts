import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Student submits a manual UPI payment: creates a pending payment linked to their screenshot. */
export const submitManualUpiPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        courseId: z.string().uuid(),
        screenshotUrl: z.string().min(1),
        upiId: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("id, title, price, is_free")
      .eq("id", data.courseId)
      .maybeSingle();
    if (!course || course.is_free || Number(course.price) <= 0)
      throw new Error("This course is not a paid course.");
    const { data: enrollment } = await supabaseAdmin
      .from("enrollments").select("id, expires_at")
      .eq("user_id", context.userId).eq("course_id", course.id).maybeSingle();
    if (enrollment?.expires_at && new Date(enrollment.expires_at) > new Date())
      throw new Error("You already have active access to this course."); 
    const { data: batch } = await supabaseAdmin.from("batches")
      .select("id").eq("course_id", course.id).eq("is_active", true)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    // Retire any earlier pending manual attempt for the same course so only one is awaiting review.
    await supabaseAdmin
      .from("payments")
      .update({ status: "failed" })
      .eq("user_id", context.userId)
      .eq("course_id", course.id)
      .eq("provider", "upi_manual")
      .eq("status", "pending");
    const { error } = await supabaseAdmin.from("payments").insert({
      user_id: context.userId,
      course_id: course.id,
      amount: Number(course.price),
      discount: 0,
      status: "pending",
      provider: "upi_manual",
      provider_ref: `upi_${data.upiId}`,
      screenshot_url: data.screenshotUrl,
      batch_id: batch?.id ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

async function getAdminClientOrThrow(
  userId: string,
  supabase: SupabaseClient<Database>,
) {
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) throw new Error("Only the institute admin can do this.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Admin approves a manual UPI payment: marks it paid and unlocks the course for that student only. */
export const approveManualPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ paymentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdminClientOrThrow(context.userId, context.supabase);
    const { data: pay } = await supabaseAdmin
      .from("payments")
      .select("id, user_id, course_id, amount, status, batch_id")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (!pay) throw new Error("Payment not found.");
    if (pay.status !== "pending") throw new Error("This payment is not waiting for approval.");
    if (!pay.course_id || !pay.user_id) throw new Error("Payment is missing the course or student.");
    const now = new Date();
    const { data: batch } = pay.batch_id
      ? await supabaseAdmin.from("batches").select("id, validity_days").eq("id", pay.batch_id).maybeSingle()
      : { data: null };
    const days = Math.max(1, Number(batch?.validity_days ?? 365));
    const { data: existing } = await supabaseAdmin.from("enrollments")
      .select("id, expires_at, renewal_count")
      .eq("user_id", pay.user_id).eq("course_id", pay.course_id).maybeSingle();
    const base = existing?.expires_at && new Date(existing.expires_at) > now ? new Date(existing.expires_at) : now;
    const expiresAt = new Date(base.getTime() + days * 86400000).toISOString();
    const { error: paymentError } = await supabaseAdmin.from("payments")
      .update({ status: "paid", paid_at: now.toISOString() }).eq("id", pay.id).eq("status", "pending");
    if (paymentError) throw paymentError;
    const access = {
      user_id: pay.user_id, course_id: pay.course_id, batch_id: pay.batch_id,
      status: "active", purchased_at: now.toISOString(), expires_at: expiresAt,
      renewal_count: (existing?.renewal_count ?? 0) + (existing ? 1 : 0),
    };
    const enrollmentWrite = existing
      ? await supabaseAdmin.from("enrollments").update(access).eq("id", existing.id)
      : await supabaseAdmin.from("enrollments").insert(access);
    if (enrollmentWrite.error) throw enrollmentWrite.error;
    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("title")
      .eq("id", pay.course_id)
      .maybeSingle();
    await supabaseAdmin.from("notifications").insert({
      user_id: pay.user_id,
      title: "Payment approved",
      body: `Your payment of ₹${Number(pay.amount)} was approved. "${course?.title ?? "Your course"}" is now unlocked.`,
      type: "payment",
    });
    return { ok: true as const };
  });

/** Admin rejects a manual UPI payment: marks it rejected so the student can submit again. */
export const rejectManualPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ paymentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdminClientOrThrow(context.userId, context.supabase);
    const { data: pay } = await supabaseAdmin
      .from("payments")
      .select("id, user_id, status")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (!pay) throw new Error("Payment not found.");
    if (pay.status !== "pending") throw new Error("This payment is not waiting for approval.");
    await supabaseAdmin.from("payments").update({ status: "rejected" }).eq("id", pay.id);
    await supabaseAdmin.from("notifications").insert({
      user_id: pay.user_id,
      title: "Payment not approved",
      body: "We could not verify your payment screenshot. Please submit your payment again from the course page.",
      type: "payment",
    });
    return { ok: true as const };
  });
