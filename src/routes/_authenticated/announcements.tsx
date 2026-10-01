import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { StudentShell } from "@/components/StudentShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/announcements")({
  head: () => ({
    meta: [
      { title: "News & announcements — JK Academy" },
      { name: "description", content: "Latest announcements from JK Academy." },
      { property: "og:title", content: "News & announcements — JK Academy" },
      { property: "og:description", content: "Latest announcements from JK Academy." },
    ],
  }),
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  const q = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, body, created_at, courses(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  return (
    <StudentShell title="News & announcements">
      {q.isLoading ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState title="No announcements yet" />
      ) : (
        <div className="space-y-3">
          {q.data.map((a) => (
            <article key={a.id} className="surface-card p-4">
              <p className="font-medium">{a.title}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(a.created_at)}
                {a.courses?.title ? ` · ${a.courses.title}` : ""}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{a.body}</p>
            </article>
          ))}
        </div>
      )}
    </StudentShell>
  );
}
