import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { StudentShell } from "@/components/StudentShell";
import { EmptyState, LoadingState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, liveStatus } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/live")({
  head: () => ({
    meta: [
      { title: "Live classes — JK Academy" },
      { name: "description", content: "Join live classes and watch recordings." },
      { property: "og:title", content: "Live classes — JK Academy" },
      { property: "og:description", content: "Join live classes and watch recordings." },
    ],
  }),
  component: LivePage,
});

function LivePage() {
  const live = useQuery({
    queryKey: ["live-all"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_classes")
        .select("*, courses(title)")
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const all = (live.data ?? []).map((l) => ({ ...l, status: liveStatus(l.scheduled_at, l.duration_minutes) }));
  const groups = {
    live: all.filter((l) => l.status === "live"),
    upcoming: all.filter((l) => l.status === "upcoming"),
    completed: all.filter((l) => l.status === "completed").reverse(),
  };

  function List({ items }: { items: typeof all }) {
    if (items.length === 0) return <EmptyState title="Nothing here yet" />;
    return (
      <div className="space-y-3">
        {items.map((l) => (
          <div key={l.id} className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium">{l.title}</p>
                {l.status === "live" && <Badge className="bg-primary">LIVE NOW</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(l.scheduled_at)} · {l.duration_minutes} min · {l.teacher_name ?? "Faculty"}
                {l.courses?.title ? ` · ${l.courses.title}` : ""}
              </p>
              {l.description && <p className="mt-1 text-sm text-muted-foreground">{l.description}</p>}
            </div>
            <div className="flex gap-2">
              {l.status !== "completed" && l.join_url && (
                <Button asChild size="sm" variant={l.status === "live" ? "default" : "outline"}>
                  <a href={l.join_url} target="_blank" rel="noreferrer">
                    {l.status === "live" ? "Join now" : "Join link"}
                  </a>
                </Button>
              )}
              {l.recording_url && (
                <Button asChild size="sm" variant="outline">
                  <a href={l.recording_url} target="_blank" rel="noreferrer">
                    Watch recording
                  </a>
                </Button>
              )}
              {l.status === "completed" && !l.recording_url && (
                <span className="text-xs text-muted-foreground">Recording coming soon</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <StudentShell title="Live classes">
      {live.isLoading ? (
        <LoadingState />
      ) : (
        <Tabs defaultValue={groups.live.length ? "live" : "upcoming"}>
          <TabsList>
            <TabsTrigger value="live">Live now ({groups.live.length})</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming ({groups.upcoming.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
          <TabsContent value="live" className="pt-4">
            <List items={groups.live} />
          </TabsContent>
          <TabsContent value="upcoming" className="pt-4">
            <List items={groups.upcoming} />
          </TabsContent>
          <TabsContent value="completed" className="pt-4">
            <List items={groups.completed} />
          </TabsContent>
        </Tabs>
      )}
    </StudentShell>
  );
}
