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
    const { data: batch } = await supabaseAdmin
      .from("batches").select("id, validity_days")
      .eq("course_id", course.id).eq("is_active", true)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    const { data: previousPayment } = await supabaseAdmin.from("payments")
      .select("id").eq("user_id", context.userId).eq("course_id", course.id)
      .eq("status", "paid").order("created_at", { ascending: false }).limit(1).maybeSingle();
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
      batch_id: batch?.id ?? null,
      renewal_of: previousPayment?.id ?? null,
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
    if (pay.status === "paid") return { ok: true as const, alreadyProcessed: true as const };
    // Access is granted only after Razorpay confirms a captured payment.
    const r = await fetch(`https://api.razorpay.com/v1/payments/${data.paymentId}`, {
      headers: { authorization: "Basic " + btoa(`${k.id}:${k.secret}`) },
    });
    const p = (await r.json()) as { order_id?: string; status?: string };
    if (!r.ok || p.order_id !== data.orderId || p.status !== "captured")
      throw new Error("Payment is not captured yet.");
    const now = new Date();
    const { data: batch } = pay.batch_id
      ? await supabaseAdmin.from("batches").select("id, validity_days").eq("id", pay.batch_id).maybeSingle()
      : { data: null };
    const validityDays = Math.max(1, Number(batch?.validity_days ?? 365));
    const { data: existing } = await supabaseAdmin.from("enrollments")
      .select("id, expires_at, renewal_count")
      .eq("user_id", context.userId).eq("course_id", pay.course_id).maybeSingle();
    const base = existing?.expires_at && new Date(existing.expires_at) > now ? new Date(existing.expires_at) : now;
    const expiresAt = new Date(base.getTime() + validityDays * 86400000).toISOString();
    const { data: paymentUpdate, error: paymentUpdateError } = await supabaseAdmin.from("payments")
      .update({ status: "paid", paid_at: now.toISOString() })
      .eq("id", pay.id).eq("status", "pending").select("id").maybeSingle();
    if (paymentUpdateError) throw paymentUpdateError;
    // A pending payment can be settled only once; duplicate callbacks must not extend access.
    if (!paymentUpdate) return { ok: true as const, alreadyProcessed: true as const };
    const enrollmentPayload = {
      user_id: context.userId, course_id: pay.course_id, batch_id: pay.batch_id,
      status: "active", purchased_at: now.toISOString(), expires_at: expiresAt,
      renewal_count: (existing?.renewal_count ?? 0) + (existing ? 1 : 0),
    };
    const enrollmentWrite = existing
      ? await supabaseAdmin.from("enrollments").update(enrollmentPayload).eq("id", existing.id)
      : await supabaseAdmin.from("enrollments").insert(enrollmentPayload);
    if (enrollmentWrite.error) {
      // Restore pending status so a verified payment can be safely retried if access-write fails.
      await supabaseAdmin.from("payments").update({ status: "pending", paid_at: null })
        .eq("id", pay.id).eq("status", "paid");
      throw enrollmentWrite.error;
    }
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
