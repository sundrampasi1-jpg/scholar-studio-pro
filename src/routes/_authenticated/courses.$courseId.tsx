import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle, CreditCard, PlayCircle, FileText, Lock } from "lucide-react";
import { StudentShell } from "@/components/StudentShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { fetchCourseProgress } from "@/lib/queries";

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

function CourseDetail() {
  const { courseId } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [coupon, setCoupon] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [checkoutState, setCheckoutState] = useState<"idle" | "unconfigured">("idle");

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

  const applyCoupon = useMutation({
    mutationFn: async () => {
      const code = coupon.trim().toUpperCase();
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", code)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("That coupon code isn't valid.");
      if (data.expires_at && new Date(data.expires_at) < new Date())
        throw new Error("That coupon has expired.");
      if (data.max_uses > 0 && data.used_count >= data.max_uses)
        throw new Error("That coupon has reached its usage limit.");
      return data.discount_percent;
    },
    onSuccess: (percent) => {
      setAppliedDiscount(percent);
      toast.success(`${percent}% discount applied`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startCheckout = useMutation({
    mutationFn: async () => {
      const price = Number(course.data?.price ?? 0);
      const discount = (price * appliedDiscount) / 100;
      const { error } = await supabase.from("payments").insert({
        user_id: user!.id,
        course_id: courseId,
        amount: price - discount,
        discount,
        coupon_code: appliedDiscount ? coupon.trim().toUpperCase() : null,
        status: "pending",
        provider: "none",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setCheckoutState("unconfigured");
      queryClient.invalidateQueries({ queryKey: ["my-payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
  const payable = price - (price * appliedDiscount) / 100;

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
            ) : (
              <>
                <p className="text-2xl font-semibold text-primary">
                  {isFree ? "Free" : `₹${payable.toFixed(0)}`}
                </p>
                {!isFree && appliedDiscount > 0 && (
                  <p className="text-xs text-muted-foreground line-through">₹{price.toFixed(0)}</p>
                )}
                {isFree ? (
                  <Button
                    className="mt-4 w-full"
                    onClick={() => enrol.mutate()}
                    disabled={enrol.isPending}
                  >
                    Enrol for free
                  </Button>
                ) : (
                  <div className="mt-4 space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={coupon}
                        onChange={(e) => setCoupon(e.target.value)}
                        placeholder="Coupon code"
                      />
                      <Button
                        variant="outline"
                        onClick={() => applyCoupon.mutate()}
                        disabled={!coupon.trim() || applyCoupon.isPending}
                      >
                        Apply
                      </Button>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => startCheckout.mutate()}
                      disabled={startCheckout.isPending}
                    >
                      <CreditCard className="mr-2 h-4 w-4" /> Proceed to payment
                    </Button>
                    {checkoutState === "unconfigured" && (
                      <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
                        <p className="font-semibold">Payment gateway not configured</p>
                        <p className="mt-1 text-muted-foreground">
                          Your order has been recorded as <strong>pending</strong>. Access is granted
                          automatically once a payment provider is connected and the payment succeeds. An
                          admin can also confirm this payment manually from the admin panel.
                        </p>
                        <Link to="/payments" className="mt-2 inline-block font-medium text-primary">
                          View my payments
                        </Link>
                      </div>
                    )}
                  </div>
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
