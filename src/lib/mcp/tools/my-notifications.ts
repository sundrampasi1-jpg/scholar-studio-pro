import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "my_notifications",
  title: "My notifications",
  description: "List the signed-in user's recent notifications and announcements.",
  inputSchema: { unread_only: z.boolean().optional().describe("Only return unread notifications.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ unread_only }, ctx) => {
    let q = supabaseForUser(ctx)
      .from("notifications")
      .select("id,title,body,type,is_read,created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (unread_only) q = q.eq("is_read", false);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const notifications = (data ?? []).map((n) => ({
      id: n.id, title: n.title, body: n.body ?? "", type: n.type, is_read: n.is_read, created_at: n.created_at,
    }));
    return { content: [{ type: "text", text: JSON.stringify(notifications) }], structuredContent: { notifications } };
  },
});
