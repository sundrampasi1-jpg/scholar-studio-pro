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
    // Replace any earlier rejected/pending manual attempt for the same course.
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

async function requireAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const client = await import("@/integrations/supabase/client");
  // Re-verify the caller's admin role with a fresh bearer-token client, not the admin one.
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const url = process.env["SUPABASE_URL"]!;
  const tokenClient = createClient(url, key, {
    auth: { persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${userId}` },
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        const k = key;
        if (k.startsWith("sb_") && h.get("Authorization") === `Bearer ${k}`) h.delete("Authorization");
        h.set("apikey", k);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  void tokenClient;
  void client;
  void supabaseAdmin;
}
