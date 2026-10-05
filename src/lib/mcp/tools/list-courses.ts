import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_courses",
  title: "List courses",
  description: "List published JK Academy courses with price, optionally filtered by a search term.",
  inputSchema: { search: z.string().trim().optional().describe("Optional text to match in the course title.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search }, ctx) => {
    let q = supabaseForUser(ctx)
      .from("courses")
      .select("id,title,description,price,is_free")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(50);
    if (search) q = q.ilike("title", `%${search}%`);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const courses = (data ?? []).map((c) => ({
      id: c.id, title: c.title, description: c.description ?? "", price: c.price, is_free: c.is_free,
    }));
    return { content: [{ type: "text", text: JSON.stringify(courses) }], structuredContent: { courses } };
  },
});
