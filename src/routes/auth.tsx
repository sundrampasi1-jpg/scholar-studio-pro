 import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

async function waitForSession(maxAttempts = 6, delayMs = 150) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return null;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const session = await waitForSession();
    if (!session) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { user: session.user };
  },
  component: () => <Outlet />,
});
