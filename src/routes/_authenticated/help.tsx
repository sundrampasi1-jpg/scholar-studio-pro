import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  GraduationCap,
  HelpCircle,
  MessageCircle,
  Phone,
  X,
  BookOpen,
  Mic,
  MoreHorizontal,
  Headset,
  ShieldCheck,
} from "lucide-react";

import { StudentShell } from "@/components/StudentShell";
import { Button } from "@/components/ui/button";
import { SupportChat } from "@/components/SupportChat";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/help")({
  head: () => ({
    meta: [
      { title: "Contact & help — JK Academy" },
      {
        name: "description",
        content: "Contact JK Academy or chat with our support team.",
      },
    ],
  }),
  component: HelpPage,
});

function HelpPage() {
  const { user } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Prevent the Help Page from scrolling behind the chat.
  useEffect(() => {
    if (!chatOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [chatOpen]);

  const quickActions = (
    <>
      <Link
        to="/courses"
        onClick={() => setChatOpen(false)}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#EADCCB] bg-[#FFFAF3] px-3.5 py-2 text-xs font-semibold text-[#75502A]"
      >
        <BookOpen size={15} />
        Courses
      </Link>

      <button
        type="button"
        onClick={() => toast.info("FAQs are coming soon.")}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#EADCCB] bg-[#FFFAF3] px-3.5 py-2 text-xs font-semibold text-[#75502A]"
      >
        <HelpCircle size={15} />
        FAQs
      </button>

      <button
        type="button"
        onClick={() => toast.info("You're already connected with JK Academy Support.")}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#EADCCB] bg-[#FFFAF3] px-3.5 py-2 text-xs font-semibold text-[#75502A]"
      >
        <Headset size={15} />
        Talk to Agent
      </button>

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMoreOpen((s) => !s)}
          className="flex items-center gap-1 rounded-full border border-[#EADCCB] bg-[#FFFAF3] px-3.5 py-2 text-xs font-semibold text-[#75502A]"
        >
          More <MoreHorizontal size={15} />
        </button>

        {moreOpen && (
          <div className="absolute bottom-12 right-0 z-50 w-44 rounded-xl border border-[#EADCCB] bg-white p-2 shadow-xl">
            <Link
              to="/doubts"
              onClick={() => {
                setMoreOpen(false);
                setChatOpen(false);
              }}
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium hover:bg-[#FFF3E2]"
            >
              <HelpCircle size={15} />
              Ask a doubt
            </Link>

            <a
              href="https://wa.me/919569551576"
              target="_blank"
              rel="noreferrer"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium hover:bg-[#FFF3E2]"
            >
              <MessageCircle size={15} />
              WhatsApp
            </a>
          </div>
        )}
      </div>
    </>
  );

  return (
    <StudentShell
      title="Contact & help"
      subtitle="We're here to help with courses, payments and studies."
    >
      {/* Help Page Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="surface-card p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F9E8D8]">
            <Phone className="h-5 w-5 text-[#A96720]" />
          </div>

          <p className="mt-3 font-medium">Call us</p>
          <p className="text-lg font-semibold">95695 51576</p>

          <Button asChild className="mt-3 w-full">
            <a href="tel:+919569551576">Call now</a>
          </Button>
        </div>

        <div className="surface-card p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F9E8D8]">
            <MessageCircle className="h-5 w-5 text-[#A96720]" />
          </div>

          <p className="mt-3 font-medium">WhatsApp</p>
          <p className="text-sm text-muted-foreground">
            Message us any time.
          </p>

          <Button asChild variant="outline" className="mt-3 w-full">
            <a
              href="https://wa.me/919569551576"
              target="_blank"
              rel="noreferrer"
            >
              Open WhatsApp
            </a>
          </Button>
        </div>

        <div className="surface-card p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F9E8D8]">
            <HelpCircle className="h-5 w-5 text-[#A96720]" />
          </div>

          <p className="mt-3 font-medium">Study doubts</p>
          <p className="text-sm text-muted-foreground">
            Ask a question and get a reply from your teacher.
          </p>

          <Button asChild variant="outline" className="mt-3 w-full">
            <Link to="/doubts">Ask a doubt</Link>
          </Button>
        </div>
      </div>

      {/* Chat Preview */}
      {user && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold">
            Chat with JK Academy
          </h2>

          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="surface-card flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-accent"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F9E8D8]">
              <MessageCircle className="h-6 w-6 text-[#A96720]" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">JK Academy Support</p>
                <span className="h-2 w-2 rounded-full bg-green-500" />
              </div>
              <p className="text-xs text-muted-foreground">
                Tap to chat with JK Academy support
              </p>
            </div>

            <span className="text-sm font-semibold text-[#A96720]">
              Open Chat
            </span>
          </button>
        </div>
      )}

      {/* Full-screen Support Chat */}
      {user && chatOpen && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-[#FFF8EE] text-[#24180F]"
          style={{
            height: "100dvh",
            width: "100%",
            overscrollBehavior: "none",
          }}
        >
          {/* Header */}
          <header className="flex shrink-0 items-center gap-3 border-b border-[#EADCCB] bg-white px-3 py-3 shadow-sm">
            <button
              type="button"
              onClick={() => {
                setChatOpen(false);
                setMoreOpen(false);
              }}
              aria-label="Close chat"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-[#FFF3E2]"
            >
              <X size={23} />
            </button>

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#DCA85E] to-[#AD651C] text-white shadow-sm">
              <GraduationCap size={25} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold text-[#302319]">
                JK Academy
              </p>
              <p className="text-xs text-[#927D69]">
                Help & Support
              </p>
            </div>

            <ShieldCheck size={21} className="text-[#B8792E]" />
          </header>

          {/* Support Information */}
          <section className="shrink-0 bg-gradient-to-b from-[#F9E8D0] to-[#FFF8EE] px-3 pb-3 pt-3">
            <div className="rounded-2xl border border-[#EED9BD] bg-white p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#F9E8D8]">
                  <Headset size={30} className="text-[#A96720]" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-bold text-[#302319]">
                      JK Academy Support
                    </p>
                    <ShieldCheck size={17} className="text-green-600" />
                  </div>

                  <p className="mt-1 text-xs text-[#897663]">
                    We're here to help you
                  </p>
                </div>

                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1.5 text-[11px] font-semibold text-green-700">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  Online
                </span>
              </div>

              {/* Contact Actions */}
              <div className="mt-3 grid grid-cols-3 divide-x divide-[#EADCCB] rounded-xl bg-[#FFFAF4]">
                <a
                  href="tel:+919569551576"
                  className="flex flex-col items-center gap-1.5 py-3 text-center transition-colors hover:bg-[#FFF0DC]"
                >
                  <Phone size={21} className="text-[#B8792E]" />
                  <span className="text-xs font-semibold">Call Us</span>
                  <span className="text-[10px] text-[#927D69]">95695 51576</span>
                </a>

                <button
                  type="button"
                  onClick={() =>
                    toast.info("Voice message bhejne ke liye neeche mic button dabayein.")
                  }
                  className="flex flex-col items-center gap-1.5 py-3 text-center transition-colors hover:bg-[#FFF0DC]"
                >
                  <Mic size={21} className="text-[#B8792E]" />
                  <span className="text-xs font-semibold">Voice Help</span>
                  <span className="text-[10px] text-[#927D69]">Tap to speak</span>
                </button>

                <a
                  href="https://wa.me/919569551576"
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center gap-1.5 py-3 text-center transition-colors hover:bg-[#FFF0DC]"
                >
                  <MessageCircle size={21} className="text-[#B8792E]" />
                  <span className="text-xs font-semibold">WhatsApp</span>
                  <span className="text-[10px] text-[#927D69]">Chat with us</span>
                </a>
              </div>
            </div>
          </section>

          {/* Actual Chat */}
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-2">
            <SupportChat
              studentId={user.id}
              senderId={user.id}
              fullHeight
              quickActions={quickActions}
            />
          </main>
        </div>,
        document.body,
      )}
    </StudentShell>
  );
      }
