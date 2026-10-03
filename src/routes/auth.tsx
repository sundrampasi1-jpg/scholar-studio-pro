import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useBranding } from "@/lib/branding";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — JK Academy" },
      { name: "description", content: "Sign in or create your JK Academy student account." },
      { property: "og:title", content: "Sign in — JK Academy" },
      { property: "og:description", content: "Access your courses, live classes and tests." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const { instituteName } = useBranding();
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [signupDone, setSignupDone] = useState(false);

  useEffect(() => {
    const target = () => {
      const saved = sessionStorage.getItem("jk_after_login");
      sessionStorage.removeItem("jk_after_login");
      const dest = redirect ?? saved ?? "/dashboard";
      return dest.startsWith("/") && !dest.startsWith("//") ? dest : "/dashboard";
    };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: target(), replace: true });
    });
    // Google returns here; the session can arrive a moment after the page loads.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: target(), replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, redirect]);

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    if (redirect) sessionStorage.setItem("jk_after_login", redirect);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
      extraParams: { prompt: "select_account" },
    });
    if (result.error) {
      setLoading(false);
      const msg = result.error.message ?? "";
      setError(/cancel|closed/i.test(msg) ? "Google sign-in was cancelled. Tap Continue with Google to try again." : msg || "Google sign-in failed.");
      return;
    }
    if (result.redirected) return;
    setLoading(false);
    toast.success("Welcome!");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || password.length < 1) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (err) {
      setError(
        err.message.toLowerCase().includes("invalid")
          ? "Email or password is incorrect."
          : err.message,
      );
      return;
    }
    toast.success("Welcome back!");
    navigate({ to: redirect ?? "/dashboard", replace: true });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = z
      .object({
        fullName: z.string().min(2, "Enter your full name."),
        email: z.string().email("Enter a valid email address."),
        password: z.string().min(6, "Password must be at least 6 characters."),
        phone: z.string().optional(),
      })
      .safeParse({ fullName, email: email.trim(), password, phone });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your details.");
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, phone },
      },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data.session) {
      toast.success("Account created");
      navigate({ to: "/dashboard", replace: true });
      return;
    }
    setSignupDone(true);
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <Link to="/" className="mx-auto mb-6">
          <Brand />
        </Link>

        <div className="surface-card p-5">
          {signupDone ? (
            <div className="space-y-3 text-center">
              <h1 className="text-lg font-semibold">Check your email</h1>
              <p className="text-sm text-muted-foreground">
                We sent a confirmation link to <span className="font-medium">{email}</span>. Confirm
                your email, then sign in.
              </p>
              <Button variant="outline" className="w-full" onClick={() => setSignupDone(false)}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
            <Button type="button" variant="outline" className="mb-4 w-full" onClick={handleGoogle} disabled={loading}>
              <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3zM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22zM6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14zM12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6z"/></svg>
              Continue with Google
            </Button>
            <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
            <Tabs value={mode} onValueChange={(v) => { setMode(v); setError(null); }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-3 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Students, teachers and admins all sign in here — you'll land in the right area
                    automatically.
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign in
                  </Button>
                  <Link
                    to="/forgot-password"
                    className="block text-center text-sm text-muted-foreground hover:underline"
                  >
                    Forgot password?
                  </Link>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-3 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Create your student account at {instituteName}.
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Mobile number (optional)</Label>
                    <Input
                      id="phone"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91…"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
