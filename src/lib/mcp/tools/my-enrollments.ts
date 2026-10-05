import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "my_enrollments",
  title: "My enrolled courses",
  description: "List the courses the signed-in student is enrolled in.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    const { data, error } = await supabaseForUser(ctx)
      .from("enrollments")
      .select("course_id,status,created_at,courses(title)")
      .eq("user_id", ctx.getUserId() ?? "");
    if (error) throw new ToolError(error.message);
    const enrollments = (data ?? []).map((e) => ({
      course_id: e.course_id,
      status: e.status,
      enrolled_at: e.created_at,
      title: (e.courses as { title?: string } | null)?.title ?? "",
    }));
    return { content: [{ type: "text", text: JSON.stringify(enrollments) }], structuredContent: { enrollments } };
  },
});
