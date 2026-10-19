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
