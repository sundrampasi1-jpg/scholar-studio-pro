import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "upcoming_live_classes",
  title: "Upcoming live classes",
  description: "List upcoming and recently started live classes with schedule and teacher.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    const since = new Date(Date.now() - 3 * 3600_000).toISOString();
    const { data, error } = await supabaseForUser(ctx)
      .from("live_classes")
      .select("id,title,description,scheduled_at,duration_minutes,teacher_name,course_id")
      .gte("scheduled_at", since)
      .order("scheduled_at")
      .limit(30);
    if (error) throw new ToolError(error.message);
    const classes = (data ?? []).map((c) => ({
      id: c.id, title: c.title, description: c.description ?? "", scheduled_at: c.scheduled_at,
      duration_minutes: c.duration_minutes, teacher: c.teacher_name ?? "", course_id: c.course_id ?? "",
    }));
    return { content: [{ type: "text", text: JSON.stringify(classes) }], structuredContent: { classes } };
  },
});
