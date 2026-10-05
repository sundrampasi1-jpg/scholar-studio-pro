import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCourses from "./tools/list-courses";
import myEnrollments from "./tools/my-enrollments";
import upcomingLive from "./tools/upcoming-live";
import myNotifications from "./tools/my-notifications";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "elevate-academy-platform",
  title: "Elevate Academy Platform",
  version: "0.1.0",
  instructions:
    "Read-only tools for the JK Academy coaching app, acting as the signed-in user: browse courses, see your enrollments, upcoming live classes and notifications.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listCourses, myEnrollments, upcomingLive, myNotifications],
});
