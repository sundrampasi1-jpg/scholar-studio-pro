import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import PDFDocument from "npm:pdfkit@0.17.2";
import { Buffer } from "node:buffer";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const FONT_URL = "https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf";
const adminDb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

type Notes = {
  title: string;
  overview: string;
  topics: { title: string; points: string[] }[];
  keyFacts: string[];
  visualHighlights: { timestamp: string; detail: string }[];
  questions: { question: string; answer: string }[];
  mcqs: { question: string; options: string[]; answer: string; explanation: string }[];
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function parseJson(text: string): Notes {
  const cleaned = text.trim().replace(/^\x60{3}(?:json)?\s*/i, "").replace(/\s*\x60{3}$/i, "");
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first < 0 || last <= first) throw new Error("AI returned notes in an unreadable format.");
  const parsed = JSON.parse(cleaned.slice(first, last + 1));
  if (!parsed || !Array.isArray(parsed.topics) || !Array.isArray(parsed.keyFacts) ||
      !Array.isArray(parsed.questions) || !Array.isArray(parsed.mcqs)) {
    throw new Error("AI notes are missing required exam sections.");
  }
  return {
    title: String(parsed.title || "Video Notes"),
    overview: String(parsed.overview || ""),
    topics: parsed.topics.map((x: any) => ({ title: String(x.title || ""), points: Array.isArray(x.points) ? x.points.map(String) : [] })),
    keyFacts: parsed.keyFacts.map(String),
    visualHighlights: Array.isArray(parsed.visualHighlights) ? parsed.visualHighlights.map((x: any) => ({ timestamp: String(x.timestamp || ""), detail: String(x.detail || "") })) : [],
    questions: parsed.questions.map((x: any) => ({ question: String(x.question || ""), answer: String(x.answer || "") })),
    mcqs: parsed.mcqs.map((x: any) => ({ question: String(x.question || ""), options: Array.isArray(x.options) ? x.options.map(String) : [], answer: String(x.answer || ""), explanation: String(x.explanation || "") })),
  };
}

async function uploadToGemini(bytes: Uint8Array, mime: string, displayName: string, geminiKey: string) {
  const start = await fetch("https://generativelanguage.googleapis.com/upload/v1beta/files", {
    method: "POST",
    headers: {
      "x-goog-api-key": geminiKey,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": mime,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });
  if (!start.ok) throw new Error("Gemini video upload could not start (" + start.status + ").");
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini did not return a resumable upload URL.");
  const uploaded = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "x-goog-api-key": geminiKey,
      "Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
  });
  if (!uploaded.ok) throw new Error("Gemini video upload failed (" + uploaded.status + ").");
  const payload = await uploaded.json();
  const file = payload.file;
  if (!file?.name || !file?.uri) throw new Error("Gemini video upload returned no file reference.");

  for (let i = 0; i < 30; i++) {
    const status = await fetch("https://generativelanguage.googleapis.com/v1beta/" + file.name, {
      headers: { "x-goog-api-key": geminiKey },
    });
    if (!status.ok) throw new Error("Could not check Gemini video processing status.");
    const current = await status.json();
    if (current.state === "ACTIVE") return { name: file.name, uri: current.uri || file.uri, mimeType: current.mimeType || mime };
    if (current.state === "FAILED") throw new Error("Gemini could not process this video file.");
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  throw new Error("Video processing is taking too long. Please retry the PDF generation.");
}

async function getVideoSource(videoUrl: string, lessonTitle: string) {
  if (/youtube\.com\/watch\?v=|youtu\.be\//i.test(videoUrl)) {
    return { kind: "youtube" as const, uri: videoUrl, mime: "video/mp4", bytes: null };
  }
  let storagePath: string | null = null;
  try {
    const url = new URL(videoUrl);
    const marker = url.pathname.includes("/object/sign/media/") ? "/object/sign/media/" :
      url.pathname.includes("/object/public/media/") ? "/object/public/media/" : null;
    if (marker) storagePath = decodeURIComponent(url.pathname.split(marker)[1] || "").replace(/\+/g, "/");
  } catch { /* A malformed URL is rejected by fetch below. */ }

  let blob: Blob;
  if (storagePath) {
    const { data, error } = await adminDb.storage.from("media").download(storagePath);
    if (error || !data) throw new Error("The saved lesson video could not be read from storage.");
    blob = data;
  } else {
    const response = await fetch(videoUrl);
    if (!response.ok) throw new Error("Could not read the lesson video (" + response.status + ").");
    blob = await response.blob();
  }
  if (!blob.size) throw new Error("The lesson video file is empty.");
  if (blob.size > 2 * 1024 * 1024 * 1024) throw new Error("This video is above Gemini's 2 GB free-tier file limit.");
  const mime = (blob.type || "video/mp4").split(";")[0];
  return { kind: "file" as const, uri: "", mime, bytes: new Uint8Array(await blob.arrayBuffer()), name: lessonTitle };
}

async function analyzeVideo(source: Awaited<ReturnType<typeof getVideoSource>>, lessonTitle: string, description: string | null, geminiKey: string) {
  let videoPart: Record<string, string>;
  if (source.kind === "youtube") videoPart = { type: "video", uri: source.uri };
  else {
    const file = await uploadToGemini(source.bytes!, source.mime, lessonTitle, geminiKey);
    videoPart = { type: "video", uri: file.uri, mime_type: file.mimeType };
  }

  const prompt = `You are an expert Indian competitive-exam teacher preparing rigorous JK Academy notes.
Analyze the actual audio AND visual stream of this exact lesson video. Read visible slides, maps, diagrams, tables, board writing and examples; listen to the teacher's spoken explanations. Do not rely only on the title or description. Never invent facts that are not supported by the video. If a detail is unclear, mark it as unclear instead of guessing.
Create bilingual notes in BOTH Hindi (Devanagari) and English for every section. Include all distinct topics in the order taught, concise topic-wise notes, important dates/names/definitions/data, visual highlights with MM:SS timestamps where possible, exam-relevant question-answer pairs, and 8-12 four-option MCQs with correct answers and short explanations. Avoid duplicate or generic questions. Make it useful for UPSC/UPPCS/SSC/state exams without adding outside facts.
Return ONLY valid JSON with this exact shape:
{"title":"...","overview":"Hindi: ...\\nEnglish: ...","topics":[{"title":"Hindi / English topic","points":["Hindi: ... | English: ..."]}],"keyFacts":["Hindi: ... | English: ..."],"visualHighlights":[{"timestamp":"MM:SS","detail":"Hindi: ... | English: ..."}],"questions":[{"question":"Hindi: ... | English: ...","answer":"Hindi: ... | English: ..."}],"mcqs":[{"question":"Hindi: ... | English: ...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"Hindi: ... | English: ..."}]}
Lesson title: ${lessonTitle}
Teacher-provided description (context only; video is the source of truth): ${description || "None"}`;

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "x-goog-api-key": geminiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gemini-3.6-flash", input: [videoPart, { type: "text", text: prompt }] }),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error("Gemini analysis failed (" + response.status + "): " + message.slice(0, 250));
  }
  const result = await response.json();
  const text = result.output_text || result.output?.map((x: any) => x.content?.map((p: any) => p.text || "").join("")).join("\n");
  if (!text) throw new Error("Gemini returned no notes for this video.");
  return parseJson(text);
}

async function makePdf(notes: Notes, lessonTitle: string) {
  const fontResponse = await fetch(FONT_URL);
  if (!fontResponse.ok) throw new Error("Hindi PDF font could not be loaded.");
  const font = Buffer.from(await fontResponse.arrayBuffer());
  const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: false, info: { Title: notes.title, Author: "JK Academy", Subject: "Bilingual exam-oriented video notes" } });
  const chunks: Uint8Array[] = [];
  doc.on("data", (chunk: Uint8Array) => chunks.push(new Uint8Array(chunk)));
  const finished = new Promise<Uint8Array>((resolve, reject) => {
    doc.on("end", () => {
      const total = chunks.reduce((sum, part) => sum + part.length, 0);
      const output = new Uint8Array(total);
      let offset = 0;
      for (const part of chunks) { output.set(part, offset); offset += part.length; }
      resolve(output);
    });
    doc.on("error", reject);
  });
  const useFont = () => doc.font(font);
  useFont();
  doc.fontSize(20).fillColor("#14532d").text("JK ACADEMY", { align: "center" });
  doc.moveDown(0.3).fontSize(16).fillColor("#111827").text(notes.title || lessonTitle, { align: "center" });
  doc.moveDown(0.25).fontSize(9).fillColor("#6b7280").text("Bilingual Video-Based Exam Notes | Hindi + English", { align: "center" });
  doc.moveDown(1);
  const section = (heading: string) => {
    doc.moveDown(0.6);
    doc.fontSize(13).fillColor("#166534").text(heading);
    doc.moveDown(0.2);
  };
  const paragraph = (value: string, size = 10) => {
    if (!value) return;
    doc.fontSize(size).fillColor("#1f2937").text(value, { width: 499, lineGap: 3, paragraphGap: 4 });
    doc.moveDown(0.2);
  };
  section("Overview / सारांश");
  paragraph(notes.overview);
  section("Topics Covered / सभी विषय");
  for (const topic of notes.topics) {
    paragraph(topic.title, 11);
    for (const point of topic.points) paragraph("• " + point);
  }
  section("Important Facts / महत्वपूर्ण तथ्य");
  for (const fact of notes.keyFacts) paragraph("• " + fact);
  if (notes.visualHighlights.length) {
    section("Slides, Diagrams & Visual Highlights / दृश्य सामग्री");
    for (const item of notes.visualHighlights) paragraph((item.timestamp ? "[" + item.timestamp + "] " : "") + item.detail);
  }
  section("Important Questions & Answers / प्रश्न-उत्तर");
  notes.questions.forEach((item, i) => {
    paragraph((i + 1) + ". " + item.question, 10);
    paragraph("Answer: " + item.answer);
  });
  section("Practice MCQs / बहुविकल्पीय प्रश्न");
  notes.mcqs.forEach((item, i) => {
    paragraph((i + 1) + ". " + item.question, 10);
    item.options.forEach((option) => paragraph(option, 9));
    paragraph("Correct answer: " + item.answer + " — " + item.explanation, 9);
  });
  doc.moveDown(1).fontSize(8).fillColor("#6b7280").text("Prepared from the lesson video for study support. Verify important current-affairs facts with official sources.", { align: "center" });
  doc.end();
  return await finished;
}

async function processJob(jobId: string, geminiKey: string) {
  const { data: job } = await adminDb.from("ai_video_pdf_jobs").select("*").eq("id", jobId).single();
  if (!job) return;
  try {
    await adminDb.from("ai_video_pdf_jobs").update({ status: "processing", attempt_count: job.attempt_count + 1, updated_at: new Date().toISOString(), error_message: null }).eq("id", jobId);
    const { data: lesson, error } = await adminDb.from("lessons").select("id,title,description,video_url").eq("id", job.lesson_id).single();
    if (error || !lesson?.video_url) throw new Error("Lesson video not found. Upload or add a video link first.");
    const source = await getVideoSource(lesson.video_url, lesson.title);
    const notes = await analyzeVideo(source, lesson.title, lesson.description, geminiKey);
    const pdf = await makePdf(notes, lesson.title);
    const path = "ai-video-notes/" + lesson.id + "/" + jobId + ".pdf";
    const upload = await adminDb.storage.from("media").upload(path, pdf, { contentType: "application/pdf", upsert: true });
    if (upload.error) throw new Error("Generated PDF could not be saved to media storage.");
    const { data: signed, error: signedError } = await adminDb.storage.from("media").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signedError || !signed?.signedUrl) throw new Error("PDF saved but a student-accessible link could not be created.");
    const { error: lessonUpdateError } = await adminDb.from("lessons").update({
      ai_pdf_url: signed.signedUrl,
      ai_pdf_source_url: lesson.video_url,
    }).eq("id", lesson.id);
    if (lessonUpdateError) throw new Error("PDF was generated but could not be attached to the lesson.");
    await adminDb.from("ai_video_pdf_jobs").update({
      status: "completed", pdf_url: signed.signedUrl, updated_at: new Date().toISOString(), completed_at: new Date().toISOString(),
    }).eq("id", jobId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF generation failed.";
    await adminDb.from("ai_video_pdf_jobs").update({
      status: "failed", error_message: message.slice(0, 500), updated_at: new Date().toISOString(),
    }).eq("id", jobId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "Supabase server environment is not configured." }, 500);
    // This endpoint is private to the authenticated TanStack server function.
    // The service-role bearer is never sent to the browser.
    if (req.headers.get("Authorization") !== `Bearer ${SERVICE_KEY}`) return json({ error: "Forbidden." }, 403);
    const body = await req.json();
    const geminiKey = String(body.geminiKey || "");
    const requestedBy = String(body.requestedBy || "");
    if (!geminiKey || !requestedBy) return json({ error: "AI server configuration is missing." }, 503);
    const { data: role } = await adminDb.from("user_roles").select("role").eq("user_id", requestedBy).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Admin access required." }, 403);
    const lessonId = String(body.lessonId || "");
    const action = body.action === "auto" ? "auto" : "manual";
    if (!lessonId) return json({ error: "Lesson ID is required." }, 400);
    if (action === "auto") {
      const { data: settings } = await adminDb.from("app_settings").select("ai_video_pdf_enabled").eq("id", true).maybeSingle();
      if (!settings?.ai_video_pdf_enabled) return json({ skipped: true, reason: "Automatic video notes are OFF." });
    }
    const { data: lesson, error: lessonError } = await adminDb.from("lessons").select("id,video_url,ai_pdf_source_url").eq("id", lessonId).single();
    if (lessonError || !lesson?.video_url) return json({ error: "Lesson video not found." }, 404);
    if (action === "auto" && lesson.ai_pdf_source_url === lesson.video_url) return json({ skipped: true, reason: "This video already has generated notes." });

    const { data: active } = await adminDb.from("ai_video_pdf_jobs").select("id,status").eq("lesson_id", lessonId).in("status", ["queued", "processing"]).maybeSingle();
    if (active) return json({ jobId: active.id, status: active.status, existing: true }, 202);
    const { data: job, error: jobError } = await adminDb.from("ai_video_pdf_jobs").insert({
      lesson_id: lessonId, requested_by: authData.user.id, source_video_url: lesson.video_url, status: "queued",
    }).select("id").single();
    if (jobError || !job) return json({ error: "Could not queue PDF generation." }, 500);
    EdgeRuntime.waitUntil(processJob(job.id, geminiKey));
    return json({ jobId: job.id, status: "queued" }, 202);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return json({ error: message }, 500);
  }
});
