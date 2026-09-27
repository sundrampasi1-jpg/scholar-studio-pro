import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type T = "courses" | "subjects" | "chapters" | "lessons" | "notes" | "tests" | "questions" | "live_classes" | "announcements" | "doubts" | "profiles";

/** Simple list query for admin pages. */
export function useRows<R = any>(table: T, opts: { order?: string; asc?: boolean; eq?: [string, string]; enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["admin", table, opts.eq?.join(":") ?? "all"],
    enabled: opts.enabled ?? true,
    queryFn: async () => {
      let q = (supabase.from(table) as any).select("*");
      if (opts.eq) q = q.eq(opts.eq[0], opts.eq[1]);
      q = q.order(opts.order ?? "created_at", { ascending: opts.asc ?? false });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as R[];
    },
  });
}

export function useCrud(table: T) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", table] });
  return {
    async save(row: Record<string, any>, id?: string) {
      const q = supabase.from(table) as any;
      const { error } = id ? await q.update(row).eq("id", id) : await q.insert(row);
      if (error) return toast.error(error.message), false;
      toast.success("Saved");
      refresh();
      return true;
    },
    async remove(id: string) {
      if (!confirm("Delete this item?")) return;
      const { error } = await (supabase.from(table) as any).delete().eq("id", id);
      if (error) return void toast.error(error.message);
      toast.success("Deleted");
      refresh();
    },
  };
}
