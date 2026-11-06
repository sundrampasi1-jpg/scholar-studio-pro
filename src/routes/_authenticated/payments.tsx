import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { StudentShell } from "@/components/StudentShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({
    meta: [
      { title: "My payments — JK Academy" },
      { name: "description", content: "Your course payment history at JK Academy." },
      { property: "og:title", content: "My payments — JK Academy" },
      { property: "og:description", content: "Your course payment history at JK Academy." },
    ],
  }),
  component: PaymentsPage,
});

const statusClass: Record<string, string> = {
  paid: "bg-success/15 text-success",
  pending: "bg-warning/15 text-warning-foreground",
  failed: "bg-destructive/10 text-destructive",
};

function PaymentsPage() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["my-payments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data, error }, { data: enrollments, error: enrollmentError }] = await Promise.all([
        supabase.from("payments")
          .select("id, amount, status, provider_ref, created_at, paid_at, course_id, batch_id, courses(title)")
          .eq("user_id", user!.id).order("created_at", { ascending: false }),
        supabase.from("enrollments")
          .select("course_id, purchased_at, expires_at, renewal_count, status")
          .eq("user_id", user!.id),
      ]);
      if (error) throw error;
      if (enrollmentError) throw enrollmentError;
      const access = new Map((enrollments ?? []).map((item) => [item.course_id, item]));
      return (data ?? []).map((payment) => ({ ...payment, access: payment.course_id ? access.get(payment.course_id) ?? null : null }));
    },
  });

  return (
    <StudentShell title="My payments">
      {q.isLoading ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState title="No payments yet" description="Paid course purchases will appear here." />
      ) : (
        <ul className="overflow-hidden rounded-3xl border border-[#D8E2EA] bg-white shadow-[0_14px_40px_rgba(18,38,63,0.10)]">
          {q.data.map((p) => (
            <li key={p.id} className="relative flex flex-wrap items-center gap-3 border-b border-[#E8EDF2] p-4 last:border-b-0 sm:p-5">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${p.status === "paid" ? "bg-[#E6F5EE] text-[#168653]" : p.status === "pending" ? "bg-[#FFF4DF] text-[#A66A12]" : "bg-[#FDEBEC] text-[#C23A45]"}`}>
                  <span className="text-lg font-black">{p.status === "paid" ? "✓" : p.status === "pending" ? "…" : "!"}</span>
                </span>
                <div className="min-w-0 flex-1">
                  {p.course_id ? (
                    <Link to="/courses/$courseId" params={{ courseId: p.course_id }} className="font-medium hover:underline">
                      {p.courses?.title ?? "Course"}
                    </Link>
                  ) : (
                    <p className="font-medium">Course</p>
                  )}
                  <p className="text-xs text-muted-foreground">Paid: {p.paid_at ? formatDateTime(p.paid_at) : "—"} · Submitted: {formatDateTime(p.created_at)}</p>
                  {p.access && <p className="mt-1 text-xs text-muted-foreground">
                    Purchased: {p.access.purchased_at ? formatDateTime(p.access.purchased_at) : "—"} · Expires: {p.access.expires_at ? new Date(p.access.expires_at).toLocaleDateString("en-IN") : "No expiry"}
                    {p.access.expires_at && new Date(p.access.expires_at) <= new Date() ? " · Expired" : ""}
                  </p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold tracking-tight text-[#172B3A]">₹{Number(p.amount).toFixed(0)}</span>
                {p.status === "paid" && p.course_id && p.access?.expires_at && new Date(p.access.expires_at) <= new Date() && (
                  <Link to="/courses/$courseId" params={{ courseId: p.course_id }} className="text-xs font-bold text-primary underline">Renew</Link>
                )}
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ring-1 ring-inset ring-current/10 ${statusClass[p.status] ?? "bg-muted"}`}>
                {p.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </StudentShell>
  );
}
