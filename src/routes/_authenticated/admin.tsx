import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Staff access is checked here; individual data operations remain protected by RLS.
export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id)
      .in("role", ["admin", "teacher"])
      .limit(1)
      .maybeSingle();
    if (!data) throw redirect({ to: "/dashboard" });
  },
  component: () => <Outlet />,
});
