import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
      .from("enrollments")
      .select("id")
      .eq("user_id", context.userId)
      .eq("course_id", course.id)
      .maybeSingle();
    if (enrollment) throw new Error("You already have access to this course.");
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
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

async function assertAdmin(userId: string, supabase: NonNullable<Parameters<typeof String>[0]> extends never ? never : { rpc: Function }) {
  void userId;
  void supabase;
}
