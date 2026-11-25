import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Notes = {
  title: string;
  overview: string;
  topics: { title: string; points: string[] }[];
  keyFacts: string[];
  visualHighlights: { timestamp: string; detail: string }[];
  questions: { question: string; answer: string }[];
  mcqs: { question: string; options: string[]; answer: string; explanation: string }[];
};

function parseNotes(text: string): Notes {
  const cleaned = text.trim().replace(/^\x60{3}(?:json)?\s*/i, "").replace(/\s*\x60{3}$/i, "");
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first < 0 || last <= first) throw new Error("AI returned notes in an unreadable format.");
  const value = JSON.parse(cleaned.slice(first, last + 1));
  if (!Array.isArray(value.topics) || !Array.isArray(value.keyFacts) ||
      !Array.isArray(value.questions) || !Array.isArray(value.mcqs)) {
    throw new Error("AI notes are missing required exam sections.");
  }
  return {
    title: String(value.title || "Video Notes"),
    overview: String(value.overview || ""),
    topics: value.topics.map((x: any) => ({ title: String(x.title || ""), points: Array.isArray(x.points) ? x.points.map(String) : [] })),
    keyFacts: value.keyFacts.map(String),
    visualHighlights: Array.isArray(value.visualHighlights) ? value.visualHighlights.map((x: any) => ({ timestamp: String(x.timestamp || ""), detail: String(x.detail || "") })) : [],
    questions: value.questions.map((x: any) => ({ question: String(x.question || ""), answer: String(x.answer || "") })),
    mcqs: value.mcqs.map((x: any) => ({ question: String(x.question || ""), options: Array.isArray(x.options) ? x.options.map(String) : [], answer: String(x.answer || ""), explanation: String(x.explanation || "") })),
  };
}

async function uploadGeminiFile(
  videoStream: ReadableStream<Uint8Array>,
  size: number,
  mime: string,
  title: string,
  key: string,
) {
  const start = await fetch("https://generativelanguage.googleapis.com/upload/v1beta/files", {
    signal: AbortSignal.timeout(30_000),
    method: "POST",
    headers: {
      "x-goog-api-key": key,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(size),
      "X-Goog-Upload-Header-Content-Type": mime,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: title } }),
  });
  if (!start.ok) throw new Error("Gemini video upload could not start (" + start.status + ").");
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini did not return a resumable upload URL.");

  // Forward the storage response stream directly. Never call blob(), arrayBuffer(),
  // or text() on the video response: Cloudflare Workers have a 128 MB isolate limit.
  const uploaded = await fetch(uploadUrl, {
    signal: AbortSignal.timeout(240_000),
    method: "POST",
    headers: {
      "x-goog-api-key": key,
      "Content-Length": String(size),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
      "Content-Type": mime,
    },
    body: videoStream,
  });
  if (!uploaded.ok) {
    const detail = (await uploaded.text()).slice(0, 300);
    throw new Error("Gemini video upload failed (" + uploaded.status + "): " + detail);
  }
  const payload = await uploaded.json();
  const file = payload.file;
  if (!file?.name || !file?.uri) throw new Error("Gemini video upload returned no file reference.");
  for (let i = 0; i < 60; i++) {
    const status = await fetch("https://generativelanguage.googleapis.com/v1beta/" + file.name, {
      signal: AbortSignal.timeout(15_000),
      headers: { "x-goog-api-key": key },
    });
    if (!status.ok) throw new Error("Could not check Gemini video processing status (" + status.status + ").");
    const current = await status.json();
    if (current.state === "ACTIVE") return { uri: current.uri || file.uri, mimeType: current.mimeType || mime };
    if (current.state === "FAILED") throw new Error("Gemini could not process this video file.");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error("Video processing is taking too long. Please retry.");
}

async function getVideoPart(videoUrl: string, title: string, adminDb: any, key: string) {
  if (/(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|shorts\/|live\/)|youtu\.be\//i.test(videoUrl)) {
    throw new Error("YouTube watch links cannot be read as uploaded lesson files. Upload the original video file to JK Academy first.");
  }
  let sourceUrl = videoUrl;
  const parsed = new URL(videoUrl);
  const marker = parsed.pathname.includes("/object/sign/media/") ? "/object/sign/media/" :
    parsed.pathname.includes("/object/public/media/") ? "/object/public/media/" : null;
  if (marker) {
    const storagePath = decodeURIComponent(parsed.pathname.split(marker)[1] || "").replace(/\+/g, "/");
    const { data, error } = await adminDb.storage.from("media").createSignedUrl(storagePath, 600);
    if (error || !data?.signedUrl) throw new Error("The saved lesson video link could not be prepared from storage.");
    sourceUrl = data.signedUrl;
  } else if (/vimeo\.com\//i.test(videoUrl) && !/\.(mp4|webm|mov)(?:\?|$)/i.test(parsed.pathname)) {
    throw new Error("Vimeo watch-page links are not supported yet. Upload the original video file first.");
  }

  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error("Could not read the lesson video (" + response.status + ").");
  if (!response.body) throw new Error("The lesson video source did not provide a readable stream.");
  const size = Number(response.headers.get("content-length") || 0);
  if (!Number.isFinite(size) || size <= 0) {
    await response.body.cancel().catch(() => undefined);
    throw new Error("The video server did not provide its file size. Re-upload the original MP4 to JK Academy and retry.");
  }
  if (size > 2 * 1024 * 1024 * 1024) {
    await response.body.cancel().catch(() => undefined);
    throw new Error("This video exceeds Gemini's 2 GB file limit.");
  }
  const mime = (response.headers.get("content-type") || "video/mp4").split(";")[0] || "video/mp4";
  const file = await uploadGeminiFile(response.body, size, mime, title, key);
  return { uri: file.uri, mimeType: file.mimeType };
}

export const requestVideoPdf = createServerFn({ method: "POST" })
  .inputValidator((data: { lessonId: string; action: "auto" | "manual" }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!role) return { ok: false as const, error: "Admin access required." };

    const geminiKey = process.env["GEMINI_API_KEY"];
    if (!geminiKey) return { ok: false as const, error: "GEMINI_API_KEY is not configured on the app server." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const adminDb = supabaseAdmin as any;
    let jobId: string | null = null;
    try {
      const { data: settings } = await adminDb.from("app_settings").select("ai_video_pdf_enabled").eq("id", true).maybeSingle();
      if (data.action === "auto" && !settings?.ai_video_pdf_enabled) return { ok: true as const, skipped: true, reason: "Automatic video notes are OFF." };

      const { data: lesson, error: lessonError } = await adminDb.from("lessons")
        .select("id,title,description,video_url,ai_pdf_source_url")
        .eq("id", data.lessonId).single();
      if (lessonError || !lesson?.video_url) return { ok: false as const, error: "Lesson video not found." };
      if (data.action === "auto" && lesson.ai_pdf_source_url === lesson.video_url) return { ok: true as const, skipped: true, reason: "This video already has AI notes." };

      const { data: active } = await adminDb.from("ai_video_pdf_jobs").select("id,status,created_at")
        .eq("lesson_id", data.lessonId).in("status", ["queued", "processing"]).maybeSingle();
      if (active) {
        const age = Date.now() - new Date(active.created_at).getTime();
        if (age < 5 * 60 * 1000) return { ok: false as const, error: "PDF generation is still running. Please wait a little longer before retrying." };
        await adminDb.from("ai_video_pdf_jobs").update({ status: "failed", error_message: "Previous job timed out; please retry.", updated_at: new Date().toISOString() }).eq("id", active.id);
      }

      const { data: job, error: jobError } = await adminDb.from("ai_video_pdf_jobs").insert({
        lesson_id: data.lessonId,
        requested_by: userId,
        source_video_url: lesson.video_url,
        status: "processing",
      }).select("id").single();
      if (jobError || !job) throw new Error("Could not create the PDF generation job.");
      jobId = job.id;

      const videoPart = await getVideoPart(lesson.video_url, lesson.title, adminDb, geminiKey);
      const prompt = `You are an expert Indian competitive-exam teacher preparing rigorous JK Academy notes.
Analyze the actual audio AND visual stream of this exact lesson video. Read visible slides, maps, diagrams, tables, board writing and examples; listen to the teacher's spoken explanations. Do not rely only on the title or description. Never invent facts not supported by the video; mark unclear details instead of guessing.
Create bilingual notes in BOTH Hindi (Devanagari) and English for every section. Include all distinct topics in the order taught, concise topic-wise notes, important dates/names/definitions/data, visual highlights with MM:SS timestamps where possible, exam-relevant question-answer pairs, and 8-12 four-option MCQs with correct answers and short explanations. Avoid duplicate or generic questions. Use UPSC/UPPCS/SSC/state-exam framing without adding outside facts.
Return ONLY valid JSON with this shape:
{"title":"...","overview":"Hindi: ...\\nEnglish: ...","topics":[{"title":"Hindi / English topic","points":["Hindi: ... | English: ..."]}],"keyFacts":["Hindi: ... | English: ..."],"visualHighlights":[{"timestamp":"MM:SS","detail":"Hindi: ... | English: ..."}],"questions":[{"question":"Hindi: ... | English: ...","answer":"Hindi: ... | English: ..."}],"mcqs":[{"question":"Hindi: ... | English: ...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"Hindi: ... | English: ..."}]}
Lesson title: ${lesson.title}
Teacher-provided description (context only): ${lesson.description || "None"}`;
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent", {
        signal: AbortSignal.timeout(240_000),
        method: "POST",
        headers: { "x-goog-api-key": geminiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [
            { file_data: { mime_type: videoPart.mimeType, file_uri: videoPart.uri } },
            { text: prompt },
          ] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
        }),
      });
      if (!response.ok) throw new Error("Gemini analysis failed (" + response.status + "): " + (await response.text()).slice(0, 300));
      const result = await response.json();
      const output = result.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("\n");
      if (!output) throw new Error("Gemini returned no notes for this video.");
      const notes = parseNotes(output);
      await adminDb.from("ai_video_pdf_jobs").update({ updated_at: new Date().toISOString() }).eq("id", jobId);
      return { ok: true as const, jobId, lessonId: lesson.id, lessonTitle: lesson.title, sourceVideoUrl: lesson.video_url, notes };
    } catch (error) {
      if (jobId) await adminDb.from("ai_video_pdf_jobs").update({
        status: "failed",
        error_message: (error instanceof Error ? error.message : "PDF generation failed.").slice(0, 500),
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);
      return { ok: false as const, error: error instanceof Error ? error.message : "AI video analysis failed." };
    }
  });

export const attachVideoPdf = createServerFn({ method: "POST" })
  .inputValidator((data: { jobId: string; lessonId: string; sourceVideoUrl: string; pdfUrl: string | null; errorMessage?: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!role) return { ok: false as const, error: "Admin access required." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const adminDb = supabaseAdmin as any;
    const { data: lesson, error } = await adminDb.from("lessons").select("video_url").eq("id", data.lessonId).single();
    if (error || lesson?.video_url !== data.sourceVideoUrl) {
      await adminDb.from("ai_video_pdf_jobs").update({ status: "failed", error_message: "Lesson video changed before the PDF could be attached.", updated_at: new Date().toISOString() }).eq("id", data.jobId);
      return { ok: false as const, error: "The lesson video changed. Generate the PDF again." };
    }
    if (!data.pdfUrl) {
      await adminDb.from("ai_video_pdf_jobs").update({ status: "failed", error_message: data.errorMessage || "PDF file creation failed.", updated_at: new Date().toISOString() }).eq("id", data.jobId);
      return { ok: false as const, error: data.errorMessage || "PDF file creation failed." };
    }
    const { error: attachError } = await adminDb.from("lessons").update({
      ai_pdf_url: data.pdfUrl,
      ai_pdf_source_url: data.sourceVideoUrl,
    }).eq("id", data.lessonId);
    if (attachError) {
      await adminDb.from("ai_video_pdf_jobs").update({ status: "failed", error_message: "PDF generated but could not be attached to the lesson.", updated_at: new Date().toISOString() }).eq("id", data.jobId);
      return { ok: false as const, error: "PDF generated but could not be attached to the lesson." };
    }
    await adminDb.from("ai_video_pdf_jobs").update({
      status: "completed",
      pdf_url: data.pdfUrl,
      updated_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }).eq("id", data.jobId);
    return { ok: true as const };
  });
