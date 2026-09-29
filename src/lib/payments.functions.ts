import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function keys() {
  const id = process.env["RAZORPAY_KEY_ID"];
  const secret = process.env["RAZORPAY_KEY_SECRET"];
  return id && secret ? { id, secret } : null;
}

/** Creates a real Razorpay order (UPI/cards/netbanking) for a paid course. */
export const createCourseOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ courseId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const k = keys();
    if (!k) return { configured: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("id, title, price, is_free")
      .eq("id", data.courseId)
      .maybeSingle();
    if (!course || course.is_free || Number(course.price) <= 0) throw new Error("This course is not a paid course.");
    const amountPaise = Math.round(Number(course.price) * 100);
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Basic " + btoa(`${k.id}:${k.secret}`),
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: `c_${Date.now()}`,
        notes: { course_id: course.id, user_id: context.userId },
      }),
    });
    if (!res.ok) throw new Error("Payment gateway rejected the order. Check your merchant account setup.");
    const order = (await res.json()) as { id: string };
    const { error } = await supabaseAdmin.from("payments").insert({
      user_id: context.userId,
      course_id: course.id,
      amount: Number(course.price),
      discount: 0,
      status: "pending",
      provider: "razorpay",
      provider_ref: order.id,
    });
    if (error) throw new Error(error.message);
    return {
      configured: true as const,
      keyId: k.id,
      orderId: order.id,
      amount: amountPaise,
      title: course.title,
    };
  });

/** Verifies Razorpay signature server-side, marks payment paid and enrols the student. */
export const verifyCoursePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        orderId: z.string().min(1),
        paymentId: z.string().min(1),
        signature: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const k = keys();
    if (!k) throw new Error("Payment gateway not configured.");
    const { createHmac, timingSafeEqual } = await import("crypto");
    const expected = createHmac("sha256", k.secret).update(`${data.orderId}|${data.paymentId}`).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(data.signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Payment verification failed.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pay } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("provider_ref", data.orderId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!pay || !pay.course_id) throw new Error("Order not found.");
    // Double-check with Razorpay that the payment was captured/authorized for this order.
    const r = await fetch(`https://api.razorpay.com/v1/payments/${data.paymentId}`, {
      headers: { authorization: "Basic " + btoa(`${k.id}:${k.secret}`) },
    });
    const p = (await r.json()) as { order_id?: string; status?: string };
    if (!r.ok || p.order_id !== data.orderId || !["captured", "authorized"].includes(p.status ?? ""))
      throw new Error("Payment not completed.");
    await supabaseAdmin.from("payments").update({ status: "paid" }).eq("id", pay.id);
    const { data: existing } = await supabaseAdmin
      .from("enrollments")
      .select("id")
      .eq("user_id", context.userId)
      .eq("course_id", pay.course_id)
      .maybeSingle();
    if (!existing)
      await supabaseAdmin.from("enrollments").insert({ user_id: context.userId, course_id: pay.course_id });
    await supabaseAdmin.from("notifications").insert({
      user_id: context.userId,
      title: "Payment successful",
      body: `₹${pay.amount} received. Your course is unlocked.`,
      type: "payment",
    });
    return { ok: true };
  });

export const markPaymentFailed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("payments")
      .update({ status: "failed" })
      .eq("provider_ref", data.orderId)
      .eq("user_id", context.userId)
      .eq("status", "pending");
    return { ok: true };
  });
