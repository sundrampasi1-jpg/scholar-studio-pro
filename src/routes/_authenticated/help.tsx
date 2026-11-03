import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { GraduationCap, HelpCircle, MessageCircle, Phone, X, BookOpen, Users } from "lucide-react";
import { StudentShell } from "@/components/StudentShell";
import { Button } from "@/components/ui/button";
import { SupportChat } from "@/components/SupportChat";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/help")({
  head: () => ({
    meta: [
      { title: "Contact & help — JK Academy" },
      { name: "description", content: "Contact JK Academy at 95695 51576 or ask a doubt." },
      { property: "og:title", content: "Contact & help — JK Academy" },
      { property: "og:description", content: "Contact JK Academy at 95695 51576 or ask a doubt." },
    ],
  }),
  component: HelpPage,
});

function HelpPage() {
  const { user } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <StudentShell title="Contact & help" subtitle="We're here to help with courses, payments and studies.">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="surface-card p-5">
          <Phone className="h-5 w-5 text-primary" />
          <p className="mt-2 font-medium">Call us</p>
          <p className="text-lg font-semibold">95695 51576</p>
          <Button asChild className="mt-3 w-full">
            <a href="tel:+919569551576">Call now</a>
          </Button>
        </div>
        <div className="surface-card p-5">
          <MessageCircle className="h-5 w-5 text-primary" />
          <p className="mt-2 font-medium">WhatsApp</p>
          <p className="text-sm text-muted-foreground">Message us any time.</p>
          <Button asChild variant="outline" className="mt-3 w-full">
            <a href="https://wa.me/919569551576" target="_blank" rel="noreferrer">Open WhatsApp</a>
          </Button>
        </div>
        <div className="surface-card p-5">
          <HelpCircle className="h-5 w-5 text-primary" />
          <p className="mt-2 font-medium">Study doubts</p>
          <p className="text-sm text-muted-foreground">Ask a question and get a reply from your teacher.</p>
          <Button asChild variant="outline" className="mt-3 w-full">
            <Link to="/doubts">Ask a doubt</Link>
          </Button>
        </div>
      </div>

      {user && (
        <div className="mt-6">
          <h2 className="mb-2 text-lg font-semibold">Chat with JK Academy</h2>
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="surface-card flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-accent"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Open chat</p>
              <p className="text-xs text-muted-foreground">Tap to chat with JK Academy support</p>
            </div>
          </button>
        </div>
      )}

      {user && chatOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-muted/30">
          {/* Top bar */}
          <div className="flex items-center gap-2 border-b bg-card px-3 py-2.5 shadow-sm">
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              aria-label="Back"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-accent"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">JK Academy</p>
              <p className="text-[11px] text-muted-foreground">Help &amp; Support</p>
            </div>
          </div>

          {/* Branded support card */}
          <div className="border-b bg-gradient-to-b from-primary/10 to-transparent px-3 pb-3 pt-3">
            <div className="surface-card flex items-center gap-3 p-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-semibold">JK Academy Support</p>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                </div>
                <p className="text-xs text-muted-foreground">We're here to help you</p>
              </div>
            </div>
            <div className="surface-card mt-2 grid grid-cols-2 divide-x p-0">
              <a
                href="tel:+919569551576"
                className="flex flex-col items-center gap-1 py-3 text-center text-xs font-medium hover:bg-accent"
              >
                <Phone className="h-4 w-4 text-primary" />
                Call us
              </a>
              <a
                href="https://wa.me/919569551576"
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center gap-1 py-3 text-center text-xs font-medium hover:bg-accent"
              >
                <MessageCircle className="h-4 w-4 text-primary" />
                WhatsApp
              </a>
            </div>
          </div>

          {/* Real chat thread */}
          <div className="min-h-0 flex-1 px-2">
            <SupportChat studentId={user.id} senderId={user.id} fullHeight />
          </div>

          {/* Quick links */}
          <div className="flex gap-2 overflow-x-auto border-t bg-card px-3 py-2">
            <Link
              to="/courses"
              className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              Courses
            </Link>
            <Link
              to="/doubts"
              className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <HelpCircle className="h-3.5 w-3.5 text-primary" />
              Ask a doubt
            </Link>
            <a
              href="tel:+919569551576"
              className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <Phone className="h-3.5 w-3.5 text-primary" />
              Talk to us
            </a>
          </div>
        </div>
      )}
    </StudentShell>
  );
                }
