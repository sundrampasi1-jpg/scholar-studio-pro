 
import { createFileRoute, Link } from "@tanstack/react-router";
import { StudentShell } from "@/components/StudentShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  User,
  Shield,
  FileText,
  Info,
  LogOut,
  HelpCircle,
  Bookmark,
  Moon,
  ChevronRight,
  GraduationCap,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — JK Academy" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const [textSize, setTextSize] = useState("medium");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      window.location.href = "/auth";
    }
  }

  const items = [
    {
      icon: User,
      title: "Account",
      desc: user?.email ?? "Manage your account",
      to: "/profile",
    },
    {
      icon: Bookmark,
      title: "My Bookmarks",
      desc: "Saved notes and lessons",
      to: "/notes",
    },
    {
      icon: HelpCircle,
      title: "Help & Support",
      desc: "FAQs, report a problem, contact us",
      to: "/help",
    },
    {
      icon: Shield,
      title: "Privacy Policy",
      desc: "How we handle your data",
      to: "/help",
    },
    {
      icon: FileText,
      title: "Terms & Conditions",
      desc: "App usage terms",
      to: "/help",
    },
    {
      icon: Info,
      title: "About JK Academy",
      desc: "App version 1.0",
      to: "/",
    },
  ];

  return (
    <StudentShell title="Settings">
      <div
        className="mx-auto w-full max-w-3xl space-y-5 pb-8"
        style={{
          fontSize:
            textSize === "small"
              ? "14px"
              : textSize === "large"
                ? "18px"
                : "16px",
        }}
      >
        <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-md">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
              <GraduationCap className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                YOUR LEARNING SPACE
              </p>
              <h2 className="mt-1 text-xl font-bold">
                Make JK Academy yours
              </h2>
              <p className="mt-1 text-sm opacity-80">
                Personalize your learning experience.
              </p>
            </div>
          </div>
        </section>

        <section className="surface-card rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <Moon className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold">Reading Text Size</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose a comfortable reading size.
              </p>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            {["small", "medium", "large"].map((size) => (
              <button
                key={size}
                type="button"
                aria-pressed={textSize === size}
                onClick={() => setTextSize(size)}
                className={`flex-1 rounded-xl border px-3 py-3 text-sm font-medium capitalize transition-colors ${
                  textSize === size
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </section>

        <section className="surface-card overflow-hidden rounded-2xl">
          <h3 className="px-5 pt-5 font-semibold">
            Account & Preferences
          </h3>

          <div className="mt-3 divide-y divide-border">
            {items.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.title}
                  to={item.to}
                  className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/40"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {item.title}
                    </span>
                    <span className="mt-1 block break-words text-xs text-muted-foreground">
                      {item.desc}
                    </span>
                  </span>

                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </section>

        <section className="surface-card rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <HelpCircle className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold">Help & Support</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Need help with your courses or account?
              </p>
            </div>
          </div>

          <Link to="/help" className="mt-4 block">
            <Button variant="outline" className="w-full">
              Visit Help Center
            </Button>
          </Link>
        </section>

        <section className="surface-card rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <Info className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold">About JK Academy</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Learn smarter. Score higher.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                App Version 1.0
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-destructive/20 p-5">
          <div className="flex items-center gap-3">
            <LogOut className="h-5 w-5 text-destructive" />
            <div className="flex-1">
              <h3 className="font-semibold">Sign Out</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Sign out of your JK Academy account on this device.
              </p>
            </div>
          </div>

          {!showLogoutConfirm ? (
            <Button
              variant="outline"
              className="mt-4 w-full"
              onClick={() => setShowLogoutConfirm(true)}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="text-sm">
                Are you sure you want to sign out?
              </p>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={signOut}>
                  Confirm
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </section>

        <p className="pb-3 text-center text-xs text-muted-foreground">
          JK Academy · Learn smarter. Score higher.
        </p>
      </div>
    </StudentShell>
  );
}
