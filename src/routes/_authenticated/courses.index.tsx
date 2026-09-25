import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { StudentShell } from "@/components/StudentShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/courses/")({
  head: () => ({
    meta: [
      { title: "Courses — JK Academy" },
      { name: "description", content: "Browse and enrol in JK Academy courses." },
      { property: "og:title", content: "Courses — JK Academy" },
      { property: "og:description", content: "Browse and enrol in JK Academy courses." },
    ],
  }),
  component: CoursesPage,
});

function CoursesPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");

  const courses = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const enrolled = useQuery({
    queryKey: ["my-course-ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((e) => e.course_id);
    },
  });

  const filter = (list: typeof courses.data) =>
    (list ?? []).filter((c) => c.title.toLowerCase().includes(q.toLowerCase()));

  const all = filter(courses.data);
  const mine = all.filter((c) => enrolled.data?.includes(c.id));

  function CourseGrid({ list }: { list: typeof all }) {
    if (courses.isLoading) return <LoadingState />;
    if (courses.error) return <ErrorState error={courses.error} onRetry={() => courses.refetch()} />;
    if (list.length === 0) return <EmptyState title="No courses found" />;
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => (
          <div key={c.id} className="surface-card flex flex-col overflow-hidden">
            {c.thumbnail_url && (
              <img src={c.thumbnail_url} alt={c.title} className="h-36 w-full object-cover" />
            )}
            <div className="flex flex-1 flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{c.title}</h3>
                {enrolled.data?.includes(c.id) && <Badge variant="secondary">Enrolled</Badge>}
              </div>
              <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">{c.description}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-primary">
                  {c.is_free || Number(c.price) === 0 ? "Free" : `₹${Number(c.price).toFixed(0)}`}
                </span>
                <Button asChild size="sm">
                  <Link to="/courses/$courseId" params={{ courseId: c.id }}>
                    {enrolled.data?.includes(c.id) ? "Open" : "View"}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <StudentShell title="Courses" subtitle="Everything available at your institute">
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search courses…"
          className="pl-9"
        />
      </div>
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All courses</TabsTrigger>
          <TabsTrigger value="mine">My courses</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="pt-4">
          <CourseGrid list={all} />
        </TabsContent>
        <TabsContent value="mine" className="pt-4">
          {mine.length === 0 ? (
            <EmptyState title="No enrolled courses yet" description="Enrol from the All courses tab." />
          ) : (
            <CourseGrid list={mine} />
          )}
        </TabsContent>
      </Tabs>
    </StudentShell>
  );
}
