import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { LoadingState, EmptyState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/students")({
  head: () => ({ meta: [{ title: "Students — JK Academy Admin" }, { name: "description", content: "View registered students and enrollments." }] }),
  component: AdminStudents,
});

function AdminStudents() {
  const [search, setSearch] = useState("");
  const users = useQuery({
    queryKey: ["admin-students"],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: enr }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("enrollments").select("user_id"),
      ]);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const e of enr ?? []) counts[e.user_id] = (counts[e.user_id] ?? 0) + 1;
      return (profiles ?? []).map((p) => ({ ...p, courses: counts[p.id] ?? 0 }));
    },
  });
  const q = search.toLowerCase();
  const list = (users.data ?? []).filter((u) => `${u.full_name} ${u.email ?? ""} ${u.phone ?? ""}`.toLowerCase().includes(q));

  return (
    <AdminShell title="Students" subtitle={`${users.data?.length ?? 0} registered users`}>
      <Input placeholder="Search by name, email or phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3 max-w-sm" />
      {users.isLoading ? <LoadingState /> : list.length === 0 ? <EmptyState title="No users found" /> : (
        <div className="grid gap-2">
          {list.map((u) => (
            <div key={u.id} className="surface-card flex flex-wrap items-center gap-2 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{u.full_name || "—"}</p>
                <p className="truncate text-xs text-muted-foreground">{u.email} {u.phone ? `· ${u.phone}` : ""}</p>
              </div>
              <span className="text-xs text-muted-foreground">{u.courses} course(s) · joined {formatDateTime(u.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
