import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, Radio, FileQuestion, Phone, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { useBranding } from "@/lib/branding";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JK Academy — Online coaching for competitive exams" },
      {
        name: "description",
        content:
          "Structured courses, live classes, tests, notes and doubt support for competitive exam preparation.",
      },
      { property: "og:title", content: "JK Academy — Online coaching for competitive exams" },
      {
        property: "og:description",
        content: "Courses, live classes, tests and doubt support in one app.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { settings, appName, instituteName } = useBranding();
  const { user, loading } = useAuth();

  const { data: courses = [] } = useQuery({
    queryKey: ["public-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, description, price, is_free, thumbnail_url")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
  });

  const features = [
    { icon: BookOpen, title: "Structured courses", text: "Course → batch → subject → chapter → lesson." },
    { icon: Radio, title: "Live classes", text: "Join live, or watch the recording later." },
    { icon: FileQuestion, title: "Tests & results", text: "Timed MCQ tests with instant scoring." },
    { icon: CheckCircle2, title: "Progress tracking", text: "Pick up exactly where you left off." },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Brand />
          <div className="flex items-center gap-2">
            {!loading && user ? (
              <Button asChild size="sm">
                <Link to="/dashboard">Go to dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/auth">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="border-b bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center md:py-20">
          <p className="mb-3 inline-block rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            {instituteName}
          </p>
          <h1 className="text-3xl font-semibold leading-tight md:text-5xl">
            {settings?.hero_title || "Learn smarter. Score higher."}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
            {settings?.hero_subtitle ||
              "Live classes, structured courses, tests and doubt support in one app."}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to={user ? "/courses" : "/auth"}>Explore courses</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">Student sign up</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="surface-card p-5">
              <f.icon className="mb-3 h-6 w-6 text-primary" />
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {courses.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-12">
          <h2 className="mb-4 text-xl font-semibold">Popular courses</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <Link key={c.id} to="/auth" className="surface-card overflow-hidden transition hover:shadow-lg">
                {c.thumbnail_url && (
                  <img src={c.thumbnail_url} alt={c.title} className="h-36 w-full object-cover" />
                )}
                <div className="p-4">
                  <h3 className="font-semibold">{c.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                  <p className="mt-3 text-sm font-semibold text-primary">
                    {c.is_free || Number(c.price) === 0 ? "Free" : `₹${Number(c.price).toFixed(0)}`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="border-t bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-xl font-semibold">About {instituteName}</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{settings?.about}</p>
          <div className="mt-6 flex flex-wrap gap-6 text-sm">
            {settings?.contact_phone && (
              <span className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" /> {settings.contact_phone}
              </span>
            )}
            {settings?.contact_email && (
              <span className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" /> {settings.contact_email}
              </span>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} {appName}. {settings?.support_info}
          </span>
          <span className="flex gap-4">
            {settings?.social_youtube && (
              <a href={settings.social_youtube} className="hover:underline">
                YouTube
              </a>
            )}
            {settings?.social_instagram && (
              <a href={settings.social_instagram} className="hover:underline">
                Instagram
              </a>
            )}
            {settings?.social_telegram && (
              <a href={settings.social_telegram} className="hover:underline">
                Telegram
              </a>
            )}
          </span>
        </div>
      </footer>
    </div>
  );
}
