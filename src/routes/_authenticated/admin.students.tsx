import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Ban, CalendarClock, CheckCircle2, UserRound } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { LoadingState, EmptyState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/queries";
import { updateStudentCourseAccess } from "@/lib/course-access.functions";

export const Route = createFileRoute("/_authenticated/admin/students")({
  head: () => ({ meta: [{ title: "Students — JK Academy Admin" }, { name: "description", content: "View students and manage their course access and batch expiry." }] }),
  component: AdminStudents,
});

type Student = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  courses: number;
};

type AccessAction = "set_expiry" | "extend" | "suspend" | "activate";

function toLocalInput(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function fullDate(value: string | null) {
  return value ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Not set";
}

function AdminStudents() {
  const qc = useQueryClient();
  const updateAccess = useServerFn(updateStudentCourseAccess);
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [expiryDrafts, setExpiryDrafts] = useState<Record<string, string>>({});
  const [extendDays, setExtendDays] = useState<Record<string, string>>({});

  const users = useQuery({
    queryKey: ["admin-students"],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: enr, error: enrollmentError }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("enrollments").select("user_id"),
      ]);
      if (error) throw error;
      if (enrollmentError) throw enrollmentError;
      const counts: Record<string, number> = {};
      for (const e of enr ?? []) counts[e.user_id] = (counts[e.user_id] ?? 0) + 1;
      return (profiles ?? []).map((p) => ({ ...p, courses: counts[p.id] ?? 0 }));
    },
  });

  const studentEnrollments = useQuery({
    queryKey: ["admin-student-enrollments", selectedStudent?.id],
    enabled: !!selectedStudent,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("id, user_id, course_id, batch_id, status, expires_at, renewal_count, courses(title), batches(name, validity_days)")
        .eq("user_id", selectedStudent!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveAccess = useMutation({
    mutationFn: async (input: { enrollmentId: string; action: AccessAction; expiresAt?: string; days?: number }) =>
      updateAccess({ data: input }),
    onSuccess: (_result, variables) => {
      toast.success(
        variables.action === "suspend" ? "Course access paused for this student."
          : variables.action === "activate" ? "Course access reactivated."
          : "Course expiry updated successfully.",
      );
      qc.invalidateQueries({ queryKey: ["admin-student-enrollments", selectedStudent?.id] });
      qc.invalidateQueries({ queryKey: ["admin-students"] });
      qc.invalidateQueries({ queryKey: ["enrollments"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const q = search.toLowerCase();
  const list = (users.data ?? []).filter((u) => `${u.full_name} ${u.email ?? ""} ${u.phone ?? ""}`.toLowerCase().includes(q));

  function saveExpiry(enrollmentId: string, currentExpiry: string | null) {
    const draft = expiryDrafts[enrollmentId] ?? toLocalInput(currentExpiry);
    if (!draft) {
      toast.error("Select a new expiry date first.");
      return;
    }
    const date = new Date(draft);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
      toast.error("Expiry date must be in the future.");
      return;
    }
    saveAccess.mutate({ enrollmentId, action: "set_expiry", expiresAt: date.toISOString() });
  }

  function extend(enrollmentId: string) {
    const days = Number(extendDays[enrollmentId] ?? "365");
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      toast.error("Enter 1 to 3650 days.");
      return;
    }
    saveAccess.mutate({ enrollmentId, action: "extend", days });
  }

  return (
    <AdminShell title="Students" subtitle={`${users.data?.length ?? 0} registered users · Tap a student to manage batch expiry and access`}>
      <Input placeholder="Search by name, email or phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3 max-w-sm" />
      {users.isLoading ? <LoadingState /> : list.length === 0 ? <EmptyState title="No users found" /> : (
        <div className="grid gap-2">
          {list.map((u) => (
            <button
              type="button"
              key={u.id}
              onClick={() => { setSelectedStudent(u); setExpiryDrafts({}); setExtendDays({}); }}
              className="surface-card flex w-full flex-wrap items-center gap-2 rounded-2xl p-4 text-left text-sm transition hover:border-primary/50 hover:shadow-md"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background"><UserRound className="h-5 w-5" /></span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{u.full_name || "—"}</span>
                  <span className="block truncate text-xs text-muted-foreground">{u.email} {u.phone ? `· ${u.phone}` : ""}</span>
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{u.courses} course(s) · joined {formatDateTime(u.created_at)}</span>
              <span className="ml-auto text-xs font-semibold text-primary">Manage ›</span>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!selectedStudent} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Student course access</DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/30 p-3">
                <p className="font-semibold">{selectedStudent.full_name || "Student"}</p>
                <p className="text-xs text-muted-foreground">{selectedStudent.email} {selectedStudent.phone ? `· ${selectedStudent.phone}` : ""}</p>
              </div>

              {studentEnrollments.isLoading ? <LoadingState /> : studentEnrollments.data?.length ? (
                studentEnrollments.data.map((enrollment) => {
                  const expiry = expiryDrafts[enrollment.id] ?? toLocalInput(enrollment.expires_at);
                  const isSuspended = enrollment.status === "suspended";
                  return (
                    <div key={enrollment.id} className="rounded-2xl border-2 border-border bg-card p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-bold">{enrollment.courses?.title ?? "Course"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {enrollment.batches?.name ?? "No batch assigned"} · Batch default: {enrollment.batches?.validity_days ?? 365} days
                          </p>
                        </div>
                        <Badge variant={isSuspended ? "destructive" : "outline"}>{isSuspended ? "ACCESS PAUSED" : "ACTIVE"}</Badge>
                      </div>

                      <div className="mt-3 rounded-xl border-2 border-[#263238] bg-white p-3 text-black">
                        <p className="text-xs font-bold uppercase tracking-wide">Current batch expiry</p>
                        <p className="mt-1 text-lg font-extrabold">{fullDate(enrollment.expires_at)}</p>
                        <p className="mt-1 text-xs">Renewals: {enrollment.renewal_count ?? 0}</p>
                      </div>

                      <div className="mt-4 space-y-3">
                        <div>
                          <label className="mb-1 block text-xs font-semibold">Set exact expiry date & time</label>
                          <Input type="datetime-local" value={expiry} onChange={(e) => setExpiryDrafts((old) => ({ ...old, [enrollment.id]: e.target.value }))} />
                          <Button className="mt-2 w-full" variant="outline" disabled={saveAccess.isPending} onClick={() => saveExpiry(enrollment.id, enrollment.expires_at)}>
                            <CalendarClock className="mr-2 h-4 w-4" /> Save expiry date
                          </Button>
                        </div>

                        <div className="rounded-xl border p-3">
                          <label className="mb-1 block text-xs font-semibold">Extend from current expiry (1–3650 days)</label>
                          <div className="flex gap-2">
                            <Input type="number" min={1} max={3650} value={extendDays[enrollment.id] ?? "365"} onChange={(e) => setExtendDays((old) => ({ ...old, [enrollment.id]: e.target.value }))} />
                            <Button disabled={saveAccess.isPending} onClick={() => extend(enrollment.id)}>Extend</Button>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">Example: 365 = 1 year, 730 = 2 years. Extending also reactivates access.</p>
                        </div>

                        {isSuspended ? (
                          <Button className="w-full" disabled={saveAccess.isPending} onClick={() => saveAccess.mutate({ enrollmentId: enrollment.id, action: "activate" })}>
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Turn access back on
                          </Button>
                        ) : (
                          <Button className="w-full" variant="destructive" disabled={saveAccess.isPending} onClick={() => saveAccess.mutate({ enrollmentId: enrollment.id, action: "suspend" })}>
                            <Ban className="mr-2 h-4 w-4" /> Pause this student's course access
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState title="This student has no course enrollments yet" />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
