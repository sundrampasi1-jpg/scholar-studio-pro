import { createFileRoute, Link } from "@tanstack/react-router";
import { HelpCircle, MessageCircle, Phone } from "lucide-react";
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
          <SupportChat studentId={user.id} senderId={user.id} />
        </div>
      )}
    </StudentShell>
  );
}
