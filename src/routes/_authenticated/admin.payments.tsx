import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/queries";

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
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const list = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, user_id, amount, status, provider, provider_ref, created_at, courses(title)")
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

  const rows = (list.data ?? []).filter((p) => {
    if (status !== "all" && p.status !== status) return false;
    const s = `${p.student?.full_name} ${p.student?.email} ${p.courses?.title} ${p.provider_ref}`.toLowerCase();
    return s.includes(q.toLowerCase());
  });
  const total = rows.filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.amount), 0);

  return (
    <AdminShell title="Payments" subtitle={`Verified revenue in view: ₹${total.toFixed(0)}`}>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Search student, course, order…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="rounded-md border bg-card px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
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
                <th className="p-3">Order</th>
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
                  <td className="p-3 text-xs text-muted-foreground">{p.provider_ref ?? "—"}</td>
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
