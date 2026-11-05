 
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  ChevronDown,
  ChevronRight,
  Send,
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
        content: "Contact JK Academy for courses, payments and study support.",
      },
    ],
  }),
  component: HelpPage,
});

const FAQS = [
  {
    q: "How can I access my purchased course?",
    a: "Open the Courses section from the bottom navigation. Your available courses will appear there. Select a course to continue studying.",
  },
  {
    q: "How can I make a payment?",
    a: "Visit the course page and select the available purchase option. If your payment is completed but access is missing, contact JK Academy Support with your payment details.",
  },
  {
    q: "Where can I find my study notes?",
    a: "Open the Notes section from the bottom navigation to access your available study material.",
  },
  {
    q: "How can I ask a study doubt?",
    a: "Open the Study Doubts option on the Help page, submit your question and wait for your teacher's reply.",
  },
  {
    q: "How do I contact my support team?",
    a: "You can send a message here, send a WhatsApp message or call JK Academy at 95695 51576.",
  },
  {
    q: "What if my course or payment is not working?",
    a: "Send a message to JK Academy Support with a short explanation and relevant screenshot. Our team can check the issue.",
  },
];

function HelpPage() {
  const { user } = useAuth();

  const [chatOpen, setChatOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!chatOpen) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [chatOpen]);

  function closeChat() {
    setChatOpen(false);
    setFaqOpen(false);
    setAgentOpen(false);
    setMoreOpen(false);
  }

  const quickLinks = (
    <>
      <Link
        to="/courses"
        onClick={closeChat}
        className="flex shrink-0 items-center gap-2 rounded-full border border-[#EADCCB] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#75502A] shadow-sm"
      >
        <BookOpen size={16} className="text-[#B87932]" />
        Courses
      </Link>

      <button
        type="button"
        onClick={() => {
          setFaqOpen((s) => !s);
          setAgentOpen(false);
          setMoreOpen(false);
          setExpandedFaq(null);
        }}
        className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2.5 text-xs font-semibold shadow-sm ${
          faqOpen
            ? "border-[#C18A45] bg-[#FFF0DC] text-[#75502A]"
            : "border-[#EADCCB] bg-white text-[#75502A]"
        }`}
      >
        <HelpCircle size={16} className="text-[#B87932]" />
        FAQs
      </button>

      <button
        type="button"
        onClick={() => {
          setAgentOpen((s) => !s);
          setFaqOpen(false);
          setMoreOpen(false);
        }}
        className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2.5 text-xs font-semibold shadow-sm ${
          agentOpen
            ? "border-[#C18A45] bg-[#FFF0DC] text-[#75502A]"
            : "border-[#EADCCB] bg-white text-[#75502A]"
        }`}
      >
        <Headset size={16} className="text-[#B87932]" />
        Talk to Agent
      </button>

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => {
            setMoreOpen((s) => !s);
            setFaqOpen(false);
            setAgentOpen(false);
          }}
          className="flex items-center gap-2 rounded-full border border-[#EADCCB] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#75502A] shadow-sm"
        >
          More <MoreHorizontal size={16} />
        </button>

        {moreOpen && (
          <div className="absolute bottom-full right-0 z-[10010] mb-3 w-52 rounded-2xl border border-[#EADCCB] bg-white p-2 shadow-xl">
            <Link
              to="/doubts"
              onClick={closeChat}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium hover:bg-[#FFF4E7]"
            >
              <HelpCircle size={18} className="text-[#B87932]" />
              Ask a doubt
            </Link>

            <a
              href="https://wa.me/919569551576"
              target="_blank"
              rel="noreferrer"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium hover:bg-[#FFF4E7]"
            >
              <MessageCircle size={18} className="text-[#B87932]" />
              WhatsApp
            </a>

            <a
              href="tel:+919569551576"
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium hover:bg-[#FFF4E7]"
            >
              <Phone size={18} className="text-[#B87932]" />
              Call support
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
      {/* Chat preview */}
      {user && (
        <div className="mb-5">
          <h2 className="mb-3 text-lg font-semibold">Chat with JK Academy</h2>

          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="group flex w-full items-center gap-3 rounded-2xl border border-[#DCC49F] bg-gradient-to-r from-[#FFF9EF] via-white to-[#F5E8D4] p-4 text-left shadow-[0_10px_28px_rgba(126,83,31,0.13)] transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F9E8D8]">
              <Headset size={25} className="text-[#A96720]" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-extrabold tracking-tight text-[#3C2918]">JK Academy Support</p>
                <span className="h-2 w-2 rounded-full bg-green-500" />
              </div>
              <p className="text-xs text-muted-foreground">
                Tap to chat with JK Academy support
              </p>
            </div>

            <span className="shrink-0 rounded-full bg-[#9B5C16] px-3 py-2 text-xs font-bold text-white shadow-sm">
              Open Chat
            </span>
          </button>
        </div>
      )}

      {/* Contact cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[#E8D8C3] bg-gradient-to-br from-white to-[#FFF4E6] p-5 shadow-[0_8px_22px_rgba(112,73,27,0.09)]">
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
          <p className="text-sm text-muted-foreground">Message us any time.</p>
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

      {/* Full-screen support chat */}
      {user && chatOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-[#FFF9F1] text-[#302319]"
            style={{
              height: "100dvh",
              width: "100%",
              overscrollBehavior: "none",
            }}
          >
            {/* Header */}
            <header className="flex shrink-0 items-center gap-3 border-b border-[#EADCCB] bg-white px-3 py-3">
              <button
                type="button"
                aria-label="Close chat"
                onClick={closeChat}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-[#FFF3E2]"
              >
                <X size={24} />
              </button>

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D8A45C] to-[#AD651C] text-white shadow-md">
                <GraduationCap size={25} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-base font-bold">JK Academy</p>
                <p className="text-xs text-[#927D69]">Help & Support</p>
              </div>

              <ShieldCheck size={22} className="text-[#B87932]" />
            </header>

            {/* Support identity and contact actions */}
            <section className="shrink-0 border-b border-[#EADCCB] bg-[#FFF9F1] px-3 py-3">
              <div className="rounded-[22px] border border-[#F0E2D1] bg-white p-3.5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#F9E8EB]">
                    <Headset size={28} className="text-[#B33B4C]" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-bold">
                        JK Academy Support
                      </p>
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-xs font-semibold text-green-700">
                        Support
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-[#897663]">
                      We're here to help you
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 divide-x divide-[#EADCCB] overflow-hidden rounded-[20px] border border-[#F0E2D1] bg-white shadow-sm">
                <a
                  href="tel:+919569551576"
                  className="flex flex-col items-center gap-2 py-3 hover:bg-[#FFF3E2]"
                >
                  <Phone size={21} className="text-[#B33B4C]" />
                  <span className="text-xs font-semibold">Call us</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    setAgentOpen(true);
                    setFaqOpen(false);
                    setMoreOpen(false);
                  }}
                  className="flex flex-col items-center gap-2 py-3 hover:bg-[#FFF3E2]"
                >
                  <Mic size={21} className="text-[#B33B4C]" />
                  <span className="text-xs font-semibold">Voice Help</span>
                </button>

                <a
                  href="https://wa.me/919569551576"
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center gap-2 py-3 hover:bg-[#FFF3E2]"
                >
                  <MessageCircle size={21} className="text-[#B33B4C]" />
                  <span className="text-xs font-semibold">WhatsApp</span>
                </a>
              </div>
            </section>

            {/* Actual chat */}
            <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#FFF9F1] p-3">
              <SupportChat
                studentId={user.id}
                senderId={user.id}
                fullHeight
              />
            </main>

            {/* FAQ / Agent panels and bottom actions */}
            <footer className="relative z-40 shrink-0 border-t border-[#EADCCB] bg-white">
              {faqOpen && (
                <div className="max-h-[45dvh] overflow-y-auto border-b border-[#EADCCB] bg-[#FFFCF7] p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-[#473321]">
                        Frequently Asked Questions
                      </p>
                      <p className="text-xs text-[#927D69]">
                        Find quick answers to common questions
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setFaqOpen(false)}
                      className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F5E9DA]"
                    >
                      <X size={19} />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {FAQS.map((faq, index) => (
                      <div
                        key={faq.q}
                        className="overflow-hidden rounded-xl border border-[#EADCCB] bg-white"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedFaq((old) =>
                              old === index ? null : index
                            )
                          }
                          className="flex w-full items-center justify-between gap-3 p-3 text-left"
                        >
                          <span className="text-sm font-semibold text-[#57432E]">
                            {faq.q}
                          </span>

                          <ChevronDown
                            size={18}
                            className={`shrink-0 text-[#B87932] transition-transform ${
                              expandedFaq === index ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {expandedFaq === index && (
                          <div className="border-t border-[#F0E4D6] px-3 py-3 text-sm leading-relaxed text-[#88735E]">
                            {faq.a}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {agentOpen && (
                <div className="border-b border-[#EADCCB] bg-[#FFFCF7] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-[#473321]">
                        Talk to JK Academy
                      </p>
                      <p className="text-xs text-[#927D69]">
                        Choose how you want to contact our team
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAgentOpen(false)}
                      className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F5E9DA]"
                    >
                      <X size={19} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href="tel:+919569551576"
                      className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D8A45C] to-[#AD651C] p-3 text-sm font-semibold text-white"
                    >
                      <Phone size={17} /> Call Agent
                    </a>

                    <a
                      href="https://wa.me/919569551576"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 rounded-xl border border-[#EADCCB] bg-white p-3 text-sm font-semibold text-[#75502A]"
                    >
                      <MessageCircle size={17} /> WhatsApp
                    </a>
                  </div>

                  <p className="mt-3 text-center text-xs text-[#927D69]">
                    You can also message our team using the chat box above.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 overflow-x-auto px-3 py-3">
                {quickLinks}
              </div>
            </footer>
          </div>,
          document.body
        )}
    </StudentShell>
  );
}
