import { createFileRoute } from "@tanstack/react-router";
import { StudentShell } from "@/components/StudentShell";
import { DailyChallenge } from "@/components/DailyChallenge";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/daily-challenge")({
  head: () => ({
    meta: [
      { title: "Daily Challenge — JK Academy" },
      { name: "description", content: "Answer today's daily challenge questions and build your streak." },
    ],
  }),
  component: DailyChallengePage,
});

function DailyChallengePage() {
  const { user } = useAuth();

  return (
    <StudentShell title="Daily Challenge">
      {user && <DailyChallenge userId={user.id} />}
    </StudentShell>
  );
      }
