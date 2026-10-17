 
import { createFileRoute } from "@tanstack/react-router";
import { StudentShell } from "@/components/StudentShell";
import { DailyChallenge } from "@/components/DailyChallenge";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/daily-challenge")({
  head: () => ({
    meta: [{ title: "Daily Challenge — JK Academy" }],
  }),
  component: DailyChallengePage,
});

function DailyChallengePage() {
  const { user } = useAuth();

  return (
    <StudentShell
      title="Daily Challenge"
      subtitle="हर दिन अभ्यास करें और अपनी तैयारी बेहतर बनाएँ।"
    >
      {user?.id ? (
        <DailyChallenge userId={user.id} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Daily Challenge देखने के लिए लॉगिन करें।
        </p>
      )}
    </StudentShell>
  );
}
