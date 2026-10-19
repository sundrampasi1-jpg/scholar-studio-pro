 
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
  Sun,
  ChevronDown,
  ChevronRight,
  GraduationCap,
} from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — JK Academy" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const [textSize, setTextSize] = useState("medium");
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("jk-academy-theme");
    const enabled = savedTheme === "dark";
    setDarkMode(enabled);
    document.documentElement.classList.toggle("dark", enabled);
  }, []);

  function toggleTheme() {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("jk-academy-theme", next ? "dark" : "light");
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  const cardClass =
    "rounded-2xl border bg-card p-4 shadow-sm";

  return (
    <StudentShell
      title="Settings"
      subtitle="Customize your JK Academy experience"
    >
      <div className="space-y-5">
        <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-md">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-9 w-9" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                Your learning space
              </p>
              <h2 className="mt-1 text-xl font-bold">
                Make JK Academy yours
              </h2>
            </div>
          </div>
        </section>

        <section className={cardClass}>
          <div className="flex items-center gap-3">
            <Moon className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-bold">Appearance</h3>
              <p className="text-sm text-muted-foreground">
                Switch between light and dark mode
              </p>
            </div>
            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleTheme}
              >
                {darkMode ? (
                  <>
                    <Sun className="mr-2 h-4 w-4" />
                    Light
                  </>
                ) : (
                  <>
                    <Moon className="mr-2 h-4 w-4" />
                    Dark
                  </>
                )}
              </Button>
            </div>
          </div>
        </section>

        <section className={cardClass}>
          <h3 className="mb-3 font-bold">Reading text size</h3>
          <div className="flex gap-2">
            {["small", "medium", "large"].map((size) => (
              <Button
                key={size}
                variant={textSize === size ? "default" : "outline"}
                className="flex-1 capitalize"
                onClick={() => setTextSize(size)}
              >
                {size}
              </Button>
            ))}
          </div>
          <p
            className="mt-3 text-muted-foreground"
            style={{
              fontSize:
                textSize === "small"
                  ? "12px"
                  : textSize === "large"
                    ? "18px"
                    : "14px",
            }}
          >
            Sample text — Learn smarter. Score higher.
          </p>
        </section>

        <section className={cardClass}>
          <h3 className="mb-3 font-bold">Account & Preferences</h3>

          <div className="divide-y">
            <Link
              to="/profile"
              className="flex items-center gap-3 py-3 hover:text-primary"
            >
              <User className="h-5 w-5 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Account</p>
                <p className="truncate text-sm text-muted-foreground">
                  {user?.email ?? "Manage your account"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4" />
            </Link>

            <Link
              to="/notes"
              className="flex items-center gap-3 py-3 hover:text-primary"
            >
              <Bookmark className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="font-semibold">My Bookmarks</p>
                <p className="text-sm text-muted-foreground">
                  Saved notes and lessons
                </p>
              </div>
              <ChevronRight className="h-4 w-4" />
            </Link>

            <Link
              to="/help"
              className="flex items-center gap-3 py-3 hover:text-primary"
            >
              <HelpCircle className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="font-semibold">Help & Support</p>
                <p className="text-sm text-muted-foreground">
                  Contact support and get help
                </p>
              </div>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className={cardClass}>
          <h3 className="mb-2 font-bold">Legal & Information</h3>

          <button
            type="button"
            onClick={() => setShowTerms((value) => !value)}
            className="flex w-full items-center gap-3 py-3 text-left"
          >
            <FileText className="h-5 w-5 text-primary" />
            <span className="flex-1 font-semibold">
              Terms & Conditions
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                showTerms ? "rotate-180" : ""
              }`}
            />
          </button>

          {showTerms && (
            <div className="mb-3 rounded-xl bg-muted/50 p-4 text-sm leading-6">
              <h4 className="mb-2 font-bold">
                JK Academy — Terms & Conditions
              </h4>
              <p>
                1. JK Academy provides educational content for learning
                and exam preparation.
              </p>
              <p className="mt-2">
                2. Students must keep their login credentials secure and
                must not share paid course access without permission.
              </p>
              <p className="mt-2">
                3. Course access, fees, refunds and validity are subject
                to the conditions shown at the time of purchase.
              </p>
              <p className="mt-2">
                4. Do not copy, resell or redistribute protected course
                materials without authorization.
              </p>
              <p className="mt-2">
                5. The academy may update these terms when necessary.
                Applicable consumer and other legal rights remain
                unaffected.
              </p>
            </div>
          )}

          <div className="border-t" />

          <button
            type="button"
            onClick={() => setShowPrivacy((value) => !value)}
            className="flex w-full items-center gap-3 py-3 text-left"
          >
            <Shield className="h-5 w-5 text-primary" />
            <span className="flex-1 font-semibold">Privacy Policy</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                showPrivacy ? "rotate-180" : ""
              }`}
            />
          </button>

          {showPrivacy && (
            <div className="mb-3 rounded-xl bg-muted/50 p-4 text-sm leading-6">
              <h4 className="mb-2 font-bold">
                How JK Academy handles your data
              </h4>
              <p>
                1. Your account may contain information such as your
                email address, profile details and learning progress.
              </p>
              <p className="mt-2">
                2. Information is used to provide account access,
                courses, tests and related app features.
              </p>
              <p className="mt-2">
                3. Do not share your password or verification codes
                with anyone.
              </p>
              <p className="mt-2">
                4. Access to information should be limited to
                authorized purposes and protected appropriately.
              </p>
              <p className="mt-2">
                5. For privacy questions or requests, contact support.
                Actual data practices depend on the services connected
                to the app.
              </p>
            </div>
          )}

          <div className="border-t" />

          <Link
            to="/"
            className="flex items-center gap-3 py-3 hover:text-primary"
          >
            <Info className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="font-semibold">About JK Academy</p>
              <p className="text-sm text-muted-foreground">
                Learn smarter. Score higher.
              </p>
            </div>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </section>

        <section className={cardClass}>
          <Button
            variant="outline"
            className="w-full justify-center"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </section>
      </div>
    </StudentShell>
  );
}
