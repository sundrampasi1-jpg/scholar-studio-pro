import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Check, ExternalLink, X } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/queries";
import { approveManualPayment, rejectManualPayment } from "@/lib/manual-payments.functions";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  head: () => ({
    meta: [
      { title: "Payments — JK Academy Admin" },
      { name: "description", content: "All student course payments." },
      { property: "og:title", content: "Payments — JK Academy Admin" },
      { property: "og:description", content: "All student course payments." },
    ],
  }),
  component: AdminPayments,
});

function AdminPayments() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [upiDraft, setUpiDraft] = useState<string | null>(null);
  const approvePayment = useServerFn(approveManualPayment);
  const rejectPayment = useServerFn(rejectManualPayment);

  const list = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, user_id, amount, status, provider, provider_ref, screenshot_url, created_at, courses(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = [...new Set(data.map((p) => p.user_id))];
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, full_name, email, phone").in("id", ids)
        : { data: [] };
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      return data.map((p) => ({ ...p, student: map.get(p.user_id) }));
    },
  });

  const settings = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("id, upi_id").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const saveUpi = useMutation({
    mutationFn: async () => {
      const value = (upiDraft ?? "").trim();
      if (!value) throw new Error("Enter a UPI ID first.");
      const { error } = await supabase.from("app_settings").update({ upi_id: value }).eq("id", true);
      if (error) throw error;
      return value;
    },
    onSuccess: (value) => {
      toast.success(`UPI ID saved: ${value}`);
      setUpiDraft(null);
      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function afterDecision() {
    queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
    queryClient.invalidateQueries({ queryKey: ["enrollments"] });
  }

  const approve = useMutation({
    mutationFn: async (paymentId: string) => approvePayment({ data: { paymentId } }),
    onSuccess: () => {
      toast.success("Approved — the course is unlocked for this student.");
      afterDecision();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async (paymentId: string) => rejectPayment({ data: { paymentId } }),
    onSuccess: () => {
      toast.success("Rejected — the student was notified to submit again.");
      afterDecision();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (list.data ?? []).filter((p) => {
    if (status !== "all" && p.status !== status) return false;
    const s = `${p.student?.full_name} ${p.student?.email} ${p.courses?.title} ${p.provider_ref}`.toLowerCase();
    return s.includes(q.toLowerCase());
  });
  const pending = rows.filter((p) => p.status === "pending");
  const total = rows.filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.amount), 0);
  const currentUpi = upiDraft ?? settings.data?.upi_id ?? "";

  return (
    <AdminShell title="Payments" subtitle={`Verified revenue in view: ₹${total.toFixed(0)}`}>
      <div className="surface-card mb-5 p-4">
        <p className="font-medium">UPI payment settings</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Students see this UPI ID (text and QR code) when they buy a course. You can change it any time.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            className="max-w-xs"
            placeholder="yourname@bank"
            value={currentUpi}
            onChange={(e) => setUpiDraft(e.target.value)}
          />
          <Button
            onClick={() => saveUpi.mutate()}
            disabled={saveUpi.isPending || upiDraft === null}
          >
            {saveUpi.isPending ? "Saving…" : "Save UPI ID"}
          </Button>
          {upiDraft !== null && (
            <Button variant="outline" onClick={() => setUpiDraft(null)}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {pending.length > 0 && (
        <div className="mb-5">
          <h2 className="mb-2 text-lg font-semibold">Pending approvals ({pending.length})</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {pending.map((p) => (
              <div key={p.id} className="surface-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.student?.full_name || "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.student?.email}</p>
                  </div>
                  <p className="font-semibold text-primary">₹{Number(p.amount).toFixed(0)}</p>
                </div>
                <p className="mt-1 truncate text-sm">{p.courses?.title ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(p.created_at)}</p>
                {p.screenshot_url ? (
                  <a
                    href={p.screenshot_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block"
                    aria-label="Open payment screenshot in full size"
                  >
                    <img
                      src={p.screenshot_url}
                      alt="Payment screenshot"
                      className="max-h-48 w-full rounded-md border object-contain"
                    />
                    <span className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
                      <ExternalLink className="h-3 w-3" /> Open full size
                    </span>
                  </a>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">No screenshot attached.</p>
                )}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => approve.mutate(p.id)} disabled={approve.isPending || reject.isPending}>
                    <Check className="mr-1 h-4 w-4" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reject.mutate(p.id)}
                    disabled={approve.isPending || reject.isPending}
                  >
                    <X className="mr-1 h-4 w-4" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Search student, course, order…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="rounded-md border bg-card px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      {list.isLoading ? (
        <LoadingState />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : !rows.length ? (
        <EmptyState title="No payments found" />
      ) : (
        <div className="surface-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3">Student</th>
                <th className="p-3">Course</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3">Proof</th>
                <th className="p-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="p-3">
                    <p className="font-medium">{p.student?.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{p.student?.email}</p>
                  </td>
                  <td className="p-3">{p.courses?.title ?? "—"}</td>
                  <td className="p-3 font-semibold">₹{Number(p.amount).toFixed(0)}</td>
                  <td className="p-3 capitalize">{p.status}</td>
                  <td className="p-3">
                    {p.screenshot_url ? (
                      <a href={p.screenshot_url} target="_blank" rel="noreferrer" className="text-primary underline">
                        View screenshot
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 text-xs">{formatDateTime(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
