 import { createFileRoute, Link } from "@tanstack/react-router";
import { StudentShell } from "@/components/StudentShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { User, Shield, FileText, Info, LogOut, HelpCircle, Bookmark, Moon } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — JK Academy" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const [textSize, setTextSize] = useState("medium");

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  const items = [
    { icon: User, title: "Account", desc: user?.email ?? "", to: "/profile" },
    { icon: Bookmark, title: "My Bookmarks", desc: "Saved notes and lessons", to: "/notes" },
    { icon: HelpCircle, title: "Help & Support", desc: "FAQs, report a problem, contact us", to: "/help" },
    { icon: Shield, title: "Privacy Policy", desc: "How we handle your data", to: "/help" },
    { icon: FileText, title: "Terms & Conditions", desc: "App usage terms", to: "/help" },
    { icon: Info, title: "About JK Academy", desc: "App version 1.0", to: "/" },
  ];

  return (
    <StudentShell title="Settings">
      <div className="space-y-5">
        <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Your learning space</p>
          <h2 className="mt-1 text-lg font-bold">Make JK Academy yours</h2>
        </section>

        <section className="surface-card p-5">
          <div className="flex items-center gap-3">
            <Moon className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Reading text size</h3>
          </div>
          <div className="mt-3 flex gap-2">
            {["small", "medium", "large
              
            "large"].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setTextSize(size)}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                  textSize === size
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Choose a comfortable reading size.
          </p>
        </section>

        <section className="surface-card overflow-hidden rounded-2xl">
          <h3 className="px-5 pt-5 font-semibold">Account & Preferences</h3>
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
                  <span className="text-muted-foreground">›</span>
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
          <Button
            variant="outline"
            className="mt-4 w-full"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </section>

        <p className="pb-3 text-center text-xs text-muted-foreground">
          JK Academy · Learn smarter. Score higher.
        </p>
      </div>
    </StudentShell>
  );
}
