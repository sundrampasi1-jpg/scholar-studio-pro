import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle, Copy, PlayCircle, FileText, Lock, ShieldCheck, X } from "lucide-react";
import { StudentShell } from "@/components/StudentShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useBranding } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { fetchCourseProgress } from "@/lib/queries";
import { uploadMedia } from "@/lib/upload";
import { submitManualUpiPayment } from "@/lib/manual-payments.functions";

export const Route = createFileRoute("/_authenticated/courses/$courseId")({
  head: () => ({
    meta: [
      { title: "Course — JK Academy" },
      { name: "description", content: "Course content, lessons and progress." },
      { property: "og:title", content: "Course — JK Academy" },
      { property: "og:description", content: "Course content, lessons and progress." },
    ],
  }),
  component: CourseDetail,
});

type CheckoutState = "closed" | "open" | "submitted" | "unconfigured";

/** Renders the UPI ID as a QR code on screen so students can scan it with any UPI app. */
function UpiQr({ upiId, payeeName, amount, note }: { upiId: string; payeeName: string; amount: number; note: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    (async () => {
      try {
        const QR = await import("qrcode");
        const uri =
          `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}` +
          `&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`;
        await QR.toCanvas(canvasRef.current, uri, { width: 224, margin: 1 });
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) setReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [upiId, payeeName, amount, note]);

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas ref={canvasRef} className="rounded-lg border bg-white p-2" aria-label="UPI payment QR code" />
      {!ready && <p className="text-xs text-muted-foreground">Generating QR code…</p>}
    </div>
  );
}

function CourseDetail() {
  const { courseId } = Route.useParams();
  const { user } = useAuth();
  const { instituteName, upiId } = useBranding();
  const queryClient = useQueryClient();
  const [checkoutState, setCheckoutState] = useState<CheckoutState>("closed");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const course = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("id", courseId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const structure = useQuery({
    queryKey: ["course-structure", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select(
          "id, name, position, chapters(id, name, position, lessons(id, title, position, is_published, video_url, pdf_url, duration_minutes))",
        )
        .eq("course_id", courseId)
        .order("position");
      if (error) throw error;
      return data;
    },
  });

  const enrollment = useQuery({
    queryKey: ["enrollment", courseId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*")
        .eq("user_id", user!.id)
        .eq("course_id", courseId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const progress = useQuery({
    queryKey: ["progress", courseId, user?.id],
    enabled: !!user && !!enrollment.data,
    queryFn: () => fetchCourseProgress(user!.id, courseId),
  });

  const completedIds = useQuery({
    queryKey: ["completed-lessons", courseId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("lesson_progress")
        .select("lesson_id, completed")
        .eq("user_id", user!.id)
        .eq("course_id", courseId);
      return (data ?? []).filter((r) => r.completed).map((r) => r.lesson_id);
    },
  });

  const enrol = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("enrollments")
        .insert({ user_id: user!.id, course_id: courseId });
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: user!.id,
        title: `Enrolled in ${course.data?.title}`,
        body: "You now have access to all lessons in this course.",
        type: "enrollment",
      });
    },
    onSuccess: () => {
      toast.success("You're enrolled!");
      queryClient.invalidateQueries({ queryKey: ["enrollment", courseId] });
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["my-course-ids"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitPayment = useServerFn(submitManualUpiPayment);

  function copyUpi() {
    if (!upiId) return;
    navigator.clipboard
      .writeText(upiId)
      .then(() => toast.success("UPI ID copied"))
      .catch(() => toast.error("Could not copy. Please note it down: " + upiId));
  }

  async function submitProof() {
    if (!upiId) return;
    if (!screenshot) {
      toast.error("Please upload your payment screenshot first.");
      return;
    }
    setSubmitting(true);
    try {
      const url = await uploadMedia(screenshot, `payment-screenshots/${user!.id}`);
      await submitPayment({ data: { courseId, screenshotUrl: url, upiId } });
      setCheckoutState("submitted");
      setScreenshot(null);
      toast.success("Payment submitted — we'll verify it shortly.");
      queryClient.invalidateQueries({ queryKey: ["my-payments"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (course.isLoading) {
    return (
      <StudentShell>
        <LoadingState />
      </StudentShell>
    );
  }
  if (course.error) {
    return (
      <StudentShell>
        <ErrorState error={course.error} onRetry={() => course.refetch()} />
      </StudentShell>
    );
  }
  if (!course.data) {
    return (
      <StudentShell>
        <EmptyState title="Course not found" />
      </StudentShell>
    );
  }

  const c = course.data;
  const isEnrolled = !!enrollment.data;
  const isFree = c.is_free || Number(c.price) === 0;
  const price = Number(c.price);

  return (
    <StudentShell title={c.title} subtitle={c.description ?? undefined}>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {structure.isLoading ? (
            <LoadingState />
          ) : (structure.data ?? []).length === 0 ? (
            <EmptyState title="Content coming soon" description="No subjects have been added yet." />
          ) : (
            <Accordion type="multiple" className="surface-card divide-y px-4">
              {(structure.data ?? []).map((s) => (
                <AccordionItem key={s.id} value={s.id} className="border-b-0">
                  <AccordionTrigger className="text-left font-medium">{s.name}</AccordionTrigger>
                  <AccordionContent>
                    {[...(s.chapters ?? [])]
                      .sort((a, b) => a.position - b.position)
                      .map((ch) => (
                        <div key={ch.id} className="mb-4">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {ch.name}
                          </p>
                          <ul className="space-y-1">
                            {[...(ch.lessons ?? [])]
                              .filter((l) => l.is_published)
                              .sort((a, b) => a.position - b.position)
                              .map((l) => {
                                const done = completedIds.data?.includes(l.id);
                                return (
                                  <li key={l.id}>
                                    {isEnrolled ? (
                                      <Link
                                        to="/lesson/$lessonId"
                                        params={{ lessonId: l.id }}
                                        className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
                                      >
                                        {done ? (
                                          <CheckCircle2 className="h-4 w-4 text-success" />
                                        ) : (
                                          <Circle className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        <span className="flex-1">{l.title}</span>
                                        {l.video_url && <PlayCircle className="h-4 w-4 text-primary" />}
                                        {l.pdf_url && <FileText className="h-4 w-4 text-muted-foreground" />}
                                      </Link>
                                    ) : (
                                      <span className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
                                        <Lock className="h-4 w-4" /> {l.title}
                                      </span>
                                    )}
                                  </li>
                                );
                              })}
                          </ul>
                        </div>
                      ))}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>

        <aside className="space-y-4">
          <div className="surface-card p-4">
            {isEnrolled ? (
              <>
                <p className="text-sm font-medium">Your progress</p>
                <Progress value={progress.data?.percent ?? 0} className="mt-3" />
                <p className="mt-2 text-xs text-muted-foreground">
                  {progress.data?.completed ?? 0} of {progress.data?.total ?? 0} lessons completed
                </p>
                {progress.data?.lastLessonId && (
                  <Button asChild className="mt-4 w-full">
                    <Link to="/lesson/$lessonId" params={{ lessonId: progress.data.lastLessonId }}>
                      Continue learning
                    </Link>
                  </Button>
                )}
              </>
            ) : checkoutState === "open" && upiId ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">Pay ₹{price.toFixed(0)} by UPI</p>
                  <Button variant="ghost" size="icon" aria-label="Close payment panel" onClick={() => setCheckoutState("closed")}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pay using any UPI app (Google Pay, PhonePe, Paytm, BHIM). Scan the QR code or send the amount to:
                </p>
                <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold">{upiId}</span>
                  <Button variant="outline" size="sm" onClick={copyUpi}>
                    <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                  </Button>
                </div>
                <UpiQr upiId={upiId} payeeName={instituteName} amount={price} note={c.title} />
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Upload payment screenshot</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
                    className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:text-primary-foreground"
                  />
                  {screenshot && (
                    <p className="truncate text-xs text-muted-foreground">Selected: {screenshot.name}</p>
                  )}
                </div>
                <Button className="w-full" onClick={submitProof} disabled={submitting || !screenshot}>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  {submitting ? "Submitting…" : "I have paid — submit proof"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  After you submit, the institute verifies your payment and unlocks the course. You'll get a
                  notification when it's approved.
                </p>
              </div>
            ) : checkoutState === "submitted" ? (
              <div className="space-y-2 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
                <p className="font-semibold">Payment submitted</p>
                <p className="text-sm text-muted-foreground">
                  We're checking your payment screenshot. Once approved, this course unlocks automatically and
                  you'll get a notification.
                </p>
                <Link to="/payments" className="inline-block text-sm font-medium text-primary underline">
                  View my payments
                </Link>
              </div>
            ) : (
              <>
                <p className="text-2xl font-semibold text-primary">{isFree ? "Free" : `₹${price.toFixed(0)}`}</p>
                {isFree ? (
                  <Button
                    className="mt-4 w-full"
                    onClick={() => enrol.mutate()}
                    disabled={enrol.isPending}
                  >
                    Enrol for free
                  </Button>
                ) : checkoutState === "unconfigured" ? (
                  <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
                    <p className="font-semibold">Online payment is being set up</p>
                    <p className="mt-1 text-muted-foreground">
                      The institute hasn't added its UPI ID yet. Please try again later or contact us at
                      95695 51576.
                    </p>
                    <Link to="/payments" className="mt-2 inline-block font-medium text-primary">
                      View my payments
                    </Link>
                  </div>
                ) : (
                  <Button
                    className="mt-4 w-full"
                    onClick={() => setCheckoutState(upiId ? "open" : "unconfigured")}
                  >
                    Buy Now
                  </Button>
                )}
              </>
            )}
          </div>

          <div className="surface-card p-4 text-sm">
            <p className="font-medium">Need help?</p>
            <p className="mt-1 text-muted-foreground">
              Ask a doubt or contact the institute directly.
            </p>
            <div className="mt-3 flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to="/doubts">Ask a doubt</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/help">Contact</Link>
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </StudentShell>
  );
}
