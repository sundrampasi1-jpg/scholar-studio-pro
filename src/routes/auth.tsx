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
  const [resolvingGoogle, setResolvingGoogle] = useState(false);

  useEffect(() => {
    const target = () => {
      const saved = sessionStorage.getItem("jk_after_login");
      sessionStorage.removeItem("jk_after_login");
      const dest = redirect ?? saved ?? "/dashboard";
      return dest.startsWith("/") && !dest.startsWith("//") ? dest : "/dashboard";
    };

    function readOAuthError(): string | null {
      const qs = new URLSearchParams(window.location.search);
      const hs = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const code = qs.get("error") ?? hs.get("error");
      const desc =
        qs.get("error_description") ?? hs.get("error_description") ?? qs.get("error_message");
      if (!code) return null;
      return desc ? `${code}: ${decodeURIComponent(desc.replace(/\+/g, " "))}` : code;
    }

    const oauthError = readOAuthError();
    const cameFromGoogle = sessionStorage.getItem("jk_google_pending") === "1";

    if (oauthError) {
      console.error("[JK Academy] Google OAuth returned an error:", oauthError, {
        href: window.location.href,
      });
    }

    let cancelled = false;

    async function resolve() {
      if (oauthError) {
        sessionStorage.removeItem("jk_google_pending");
        setError(`Google sign-in failed: ${oauthError}`);
        return;
      }

      if (cameFromGoogle) setResolvingGoogle(true);
      const attempts = cameFromGoogle ? 20 : 1;

      for (let i = 0; i < attempts; i++) {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;

        if (data.session) {
          sessionStorage.removeItem("jk_google_pending");
          navigate({ to: target(), replace: true });
          return;
        }

        if (i < attempts - 1) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      if (cameFromGoogle && !cancelled) {
        sessionStorage.removeItem("jk_google_pending");
        setResolvingGoogle(false);

        console.error(
          "[JK Academy] Returned from Google with no session and no error param.",
          { href: window.location.href },
        );

        setError(
          "Google sign-in didn't complete, and returned no error details — this points to the OAuth redirect/config, not the app. Please tap Continue with Google again.",
        );
      }
    }

    resolve();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        cancelled = true;
        sessionStorage.removeItem("jk_google_pending");
        navigate({ to: target(), replace: true });
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate, redirect]);

  async function handleGoogle() {
    setError(null);
    setLoading(true);

    if (redirect) {
      sessionStorage.setItem("jk_after_login", redirect);
    }

    sessionStorage.setItem("jk_google_pending", "1");

    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
      extraParams: { prompt: "select_account" },
    });

    if (result.error) {
      sessionStorage.removeItem("jk_google_pending");
      setLoading(false);

      const msg = result.error.message ?? "";

      setError(
        /cancel|closed/i.test(msg)
          ? "Google sign-in was cancelled. Tap Continue with Google to try again."
          : msg || "Google sign-in failed.",
      );

      return;
    }

    if (result.redirected) return;

    sessionStorage.removeItem("jk_google_pending");
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
      .safeParse({
        fullName,
        email: email.trim(),
        password,
        phone,
      });

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
                We sent a confirmation link to{" "}
                <span className="font-medium">{email}</span>.
                Confirm your email, then sign in.
              </p>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setSignup
