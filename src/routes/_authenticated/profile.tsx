 import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  User,
  Camera,
  BookOpen,
  Wallet,
  FileText,
  FileQuestion,
  Radio,
  Bell,
  Settings,
  KeyRound,
  Phone,
  Shield,
  FileCheck,
  LogOut,
} from "lucide-react";
import { StudentShell } from "@/components/StudentShell";
import { LoadingState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My profile — JK Academy" },
      { name: "description", content: "Manage your JK Academy student profile, courses, payments and more." },
      { property: "og:title", content: "My profile — JK Academy" },
      { property: "og:description", content: "Manage your JK Academy student profile, courses, payments and more." },
    ],
  }),
  component: ProfilePage,
});

const statusClass: Record<string, string> = {
  paid: "bg-success/15 text-success",
  pending: "bg-warning/15 text-warning-foreground",
  failed: "bg-destructive/10 text-destructive",
};

function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const payments = useQuery({
    queryKey: ["my-payments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, status, provider_ref, created_at, course_id, courses(title)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const myCourses = (payments.data ?? []).filter((p) => p.status === "paid" && p.course_id);

  useEffect(() => {
    if (profile.data) {
      setFullName(profile.data.full_name ?? "");
      setPhone(profile.data.phone ?? "");
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (fullName.trim().length < 2) throw new Error("Enter your full name.");
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), phone: phone.trim() || null })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["profile"] });
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `avatars/${user.id}.${ext}`;
      const { error: upErr } = await supabase.storage.from("media").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: pub.publicUrl })
        .eq("id", user.id);
      if (dbErr) throw dbErr;
      toast.success("Photo updated");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (err: any) {
      toast.error(err.message ?? "Could not update photo");
    } finally {
      setUploading(false);
    }
  }

  async function resetPassword() {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email);
    if (error) toast.error(error.message);
    else toast.success("Password reset link sent to your email");
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  const studentId = user?.id ? user.id.slice(0, 8).toUpperCase() : "—";

  if (profile.isLoading) {
    return (
      <StudentShell title="My profile">
        <LoadingState />
      </StudentShell>
    );
  }

  return (
    <StudentShell title="My profile">
      <div className="space-y-5">
        {/* Header card */}
        <div className="surface-card flex flex-wrap items-center gap-4 p-5">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-primary/10">
              {profile.data?.avatar_url ? (
                <img src={profile.data.avatar_url} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <User className="h-9 w-9 text-primary" />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"
              aria-label="Change photo"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold">{profile.data?.full_name || "Student"}</p>
            <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
            <p className="text-xs text-muted-foreground">Student ID: {studentId}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancel" : "Edit profile"}
          </Button>
        </div>

        {/* Edit form */}
        {editing && (
          <form
            className="surface-card space-y-3 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label>Gmail / Email</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pn">Full name</Label>
              <Input id="pn" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pp">Mobile number</Label>
              <Input id="pp" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button type="submit" disabled={save.isPending}>Save changes</Button>
          </form>
        )}

        {/* My Courses */}
        <section className="surface-card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><BookOpen className="h-4 w-4 text-primary" /> My courses</h2>
          {myCourses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No purchased batches yet.</p>
          ) : (
            <ul className="divide-y">
              {myCourses.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2">
                  <Link to="/courses/$courseId" params={{ courseId: p.course_id! }} className="text-sm font-medium hover:underline">
                    {p.courses?.title ?? "Course"}
                  </Link>
                  <span className="text-xs text-muted-foreground">{formatDateTime(p.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* My Payments */}
        <section className="surface-card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><Wallet className="h-4 w-4 text-primary" /> My payments</h2>
          {!payments.data?.length ? (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <ul className="divide-y">
              {payments.data.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <span className="flex-1 min-w-0 truncate">{p.courses?.title ?? "Course"}</span>
                  <span className="font-semibold">₹{Number(p.amount).toFixed(0)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusClass[p.status] ?? "bg-muted"}`}>{p.status}</span>
                  {p.provider_ref && <span className="w-full text-[10px] text-muted-foreground">Txn: {p.provider_ref}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Quick links grid */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Link to="/notes" className="surface-card flex flex-col items-center gap-2 p-4 text-center text-sm font-medium">
            <FileText className="h-5 w-5 text-primary" /> My PDFs & Notes
          </Link>
          <Link to="/tests" className="surface-card flex flex-col items-center gap-2 p-4 text-center text-sm font-medium">
            <FileQuestion className="h-5 w-5 text-primary" /> My tests
          </Link>
          <Link to="/live" className="surface-card flex flex-col items-center gap-2 p-4 text-center text-sm font-medium">
            <Radio className="h-5 w-5 text-primary" /> Live classes
          </Link>
          <Link to="/notifications" className="surface-card flex flex-col items-center gap-2 p-4 text-center text-sm font-medium">
            <Bell className="h-5 w-5 text-primary" /> Notifications
          </Link>
          <Link to="/help" className="surface-card flex flex-col items-center gap-2 p-4 text-center text-sm font-medium">
            <Phone className="h-5 w-5 text-primary" /> Help & support
          </Link>
          <button onClick={resetPassword} className="surface-card flex flex-col items-center gap-2 p-4 text-center text-sm font-medium">
            <KeyRound className="h-5 w-5 text-primary" /> Reset passw
