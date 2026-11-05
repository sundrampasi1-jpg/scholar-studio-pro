import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { StudentShell } from "@/components/StudentShell";
import { LoadingState, ErrorState, EmptyState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { FileText, Clock, MessageCircle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-reports")({
  component: MyReportsPage,
});

function MyReportsPage() {
  const { user } = useAuth();

  const reports = useQuery({
    queryKey: ["my-lesson-reports", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_reports")
        .select("id, lesson_id, reason, details, status, created_at, ai_reply, ai_replied_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const rows = data ?? [];
      const lessonIds = [...new Set(rows.map((row) => row.lesson_id).filter(Boolean))];
      if (!lessonIds.length) return rows.map((row) => ({ ...row, lesson_title: null }));
      const { data: lessons, error: lessonError } = await supabase
        .from("lessons")
        .select("id, title")
        .in("id", lessonIds);
      // Lesson titles are supplementary: a title lookup/RLS hiccup must not hide saved reports.
      if (lessonError) console.error("My reports: lesson title lookup failed", lessonError);
      const titles = new Map((lessons ?? []).map((lesson) => [lesson.id, lesson.title]));
      return rows.map((row) => ({ ...row, lesson_title: titles.get(row.lesson_id) ?? null }));
    },
  });

  const dateText = (value: string) =>
    new Date(value).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <StudentShell>
      <div className="mx-auto w-full max-w-3xl min-w-0 space-y-5">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-gold-deep">
            <FileText className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold">My Reports</h1>
            <p className="text-sm text-muted-foreground">
              Your lesson problem reports and replies
            </p>
          </div>
        </div>

        {reports.isLoading && <LoadingState />}

        {reports.error && (
          <ErrorState
            error={reports.error}
            onRetry={() => void reports.refetch()}
          />
        )}

        {!reports.isLoading && !reports.error && reports.data?.length === 0 && (
          <EmptyState
            title="No reports yet"
            description="Your lesson problem reports will appear here."
          />
        )}

        <div className="space-y-4">
          {reports.data?.map((report) => {
            return (
              <article
                key={report.id}
                className="min-w-0 overflow-hidden rounded-2xl border border-gold/30 bg-cream p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-gold-deep">
                      Reported lesson
                    </p>
                    <h2 className="mt-1 break-words text-base font-extrabold">
                      {report.lesson_title || "Lesson"}
                    </h2>
                  </div>

                  <span className="shrink-0 rounded-full bg-gold/15 px-3 py-1 text-xs font-bold text-gold-deep">
                    {report.status || "Open"}
                  </span>
                </div>

                <div className="mt-4 rounded-xl border border-border bg-background p-3">
                  <p className="text-xs font-bold text-muted-foreground">
                    PROBLEM
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold">
                    {report.reason}
                  </p>

                  {report.details && (
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {report.details}
                    </p>
                  )}
                </div>

                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Submitted: {dateText(report.created_at)}
                </p>

                <div className="mt-4 rounded-xl border border-gold/30 bg-gold/10 p-3">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-gold-deep" />
                    <p className="text-sm font-extrabold text-gold-deep">
                      JK Academy AI Response
                    </p>
                  </div>

                  {report.ai_reply ? (
                    <>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground">
                        {report.ai_reply}
                      </p>
                      {report.ai_replied_at && (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Replied: {dateText(report.ai_replied_at)}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Your report has been received. The response will appear here when available.
                    </p>
                  )}
                </div>

                {report.status === "resolved" && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    Report resolved
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </StudentShell>
  );
}
