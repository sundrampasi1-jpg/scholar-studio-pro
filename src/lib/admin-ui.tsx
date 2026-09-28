import type { ReactNode, SelectHTMLAttributes } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

export function NativeSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
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

/** Notify all students (global notification). */
export async function notifyAll(
  supabase: typeof import("@/integrations/supabase/client").supabase,
  title: string,
  type: string,
  link?: string,
) {
  await supabase.from("notifications").insert({ title, type, link: link ?? null, user_id: null });
}
