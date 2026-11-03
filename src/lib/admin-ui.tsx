 
import type { ReactNode, SelectHTMLAttributes } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

export function NativeSelect(
  props: SelectHTMLAttributes<HTMLSelectElement>,
) {
  return (
    <select
      {...props}
      className={cn(
        "h-9 w-full rounded-md border border-input bg-background px-3 text-sm",
        props.className,
      )}
    />
  );
}

/** Runs a database call, shows a toast, returns true on success. */
export async function run(
  p: PromiseLike<{ error: { message: string } | null }>,
  ok = "Saved",
): Promise<boolean> {
  const { error } = await p;

  if (error) {
    toast.error(error.message);
    return false;
  }

  toast.success(ok);
  return true;
}

export function confirmDelete(what: string) {
  return window.confirm(`Delete ${what}? This cannot be undone.`);
}

/** Creates a separate notification for every student. */
export async function notifyAll(
  supabase: typeof import("@/integrations/supabase/client").supabase,
  title: string,
  type: string,
  link?: string,
) {
  const { data: students, error: studentsError } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "student");

  if (studentsError) {
    toast.error(`Could not load students: ${studentsError.message}`);
    return;
  }

  const studentIds = [
    ...new Set((students ?? []).map((student) => student.user_id)),
  ];

  if (studentIds.length === 0) {
    toast.error("No students found. Notification was not sent.");
    return;
  }

  const notifications = studentIds.map((user_id) => ({
    user_id,
    title,
    body: "",
    type,
    link: link ?? null,
    is_read: false,
  }));

  const { error: insertError } = await supabase
    .from("notifications")
    .insert(notifications);

  if (insertError) {
    toast.error(`Notification failed: ${insertError.message}`);
  }
}
