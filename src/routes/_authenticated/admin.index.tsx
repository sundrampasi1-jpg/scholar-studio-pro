import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, FileQuestion, FileText, HelpCircle, PlayCircle, Radio, Users } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin dashboard — JK Academy" },
      { name: "description", content: "Manage courses, videos, notes, tests and live classes." },
      { property: "og:title", content: "Admin dashboard — JK Academy" },
      { property: "og:description", content: "Manage courses, videos, notes, tests and live classes." },
    ],
  }),
  component: AdminHome,
});

async function count(table: "courses" | "lessons" | "notes" | "tests" | "live_classes" | "profiles" | "doubts") {
  const { count: c } = await supabase.from(table).select("id", { count: "exact", head: true });
  return c ?? 0;
}

function AdminHome() {
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [courses, lessons, notes, tests, live, students, doubts] = await Promise.all([
        count("courses"),
        count("lessons"),
        count("notes"),
        count("tests"),
        count("live_classes"),
        count("profiles"),
        count("doubts"),
      ]);
      return { courses, lessons, notes, tests, live, students, doubts };
    },
  });
  const s = stats.data;
  const cards = [
    { label: "Courses", value: s?.courses, icon: BookOpen, to: "/admin/courses" },
    { label: "Lessons / videos", value: s?.lessons, icon: PlayCircle, to: "/admin/courses" },
    { label: "PDFs & notes", value: s?.notes, icon: FileText, to: "/admin/notes" },
    { label: "Tests", value: s?.tests, icon: FileQuestion, to: "/admin/tests" },
    { label: "Live classes", value: s?.live, icon: Radio, to: "/admin/live" },
    { label: "Doubts", value: s?.doubts, icon: HelpCircle, to: "/admin/doubts" },
    { label: "Users", value: s?.students, icon: Users, to: "/admin/students" },
  ] as const;

  return (
    <AdminShell title="Admin dashboard" subtitle="Everything you add here appears for students automatically">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="surface-card p-4 hover:shadow-lg">
            <c.icon className="mb-2 h-5 w-5 text-primary" />
            <p className="text-2xl font-semibold">{c.value ?? "–"}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </Link>
        ))}
      </div>
      <div className="surface-card mt-6 p-4 text-sm">
        <p className="font-medium">Quick start</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Create a course in Courses, then add subjects → chapters → lessons.</li>
          <li>In each lesson, upload or record a video and attach a PDF.</li>
          <li>Add tests with questions, schedule live classes, and upload extra notes.</li>
        </ol>
      </div>
    </AdminShell>
  );
}
