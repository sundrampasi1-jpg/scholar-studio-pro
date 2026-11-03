import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models";
const AUDIO_RE = /^https?:\/\/\S+\.(webm|ogg|mp3|m4a|wav)(\?\S*)?$/i;
const IMAGE_RE = /^https?:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?$/i;

const SYSTEM = `You are "JK Academy AI", the friendly study assistant of JK Academy, an Indian competitive-exam coaching institute.
Reply in the same language the student uses (Hindi, Hinglish or English). Keep answers short, clear and helpful.
Help with study doubts, exam preparation and app usage. For payment, enrollment or account problems, tell the student the JK Academy team will also check, and they can call/WhatsApp 95695 51576.`;

function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function pcmToWav(pcm: Uint8Array, rate = 24000) {
  const h = new DataView(new ArrayBuffer(44));
  const w = (o: number, t: string) => [...t].forEach((c, i) => h.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); h.setUint32(4, 36 + pcm.length, true); w(8, "WAVE"); w(12, "fmt ");
  h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, 1, true);
  h.setUint32(24, rate, true); h.setUint32(28, rate * 2, true); h.setUint16(32, 2, true);
  h.setUint16(34, 16, true); w(36, "data"); h.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(h.buffer), 0); out.set(pcm, 44);
  return out;
}

async function geminiAny(models: string[], body: unknown, key: string) {
  let lastErr: unknown;
  for (const m of models) {
    try { return await gemini(m, body, key); } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

async function gemini(model: string, body: unknown, key: string) {
  const res = await fetch(`${GEMINI}/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("Gemini error", res.status, await res.text());
    throw new Error(res.status === 429 ? "AI abhi busy hai, thodi der baad try karein." : "AI reply nahi de paya.");
  }
  return (await res.json()) as { candidates?: { content?: { parts?: { text?: string; inlineData?: { data: string; mimeType?: string } }[] } }[] };
}

export const askChatAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const key = process.env["GEMINI_API_KEY"];
    if (!key) return { ok: false as const, error: "AI configured nahi hai." };

    const { data: settings } = await supabase.from("app_settings").select("ai_chat_enabled").maybeSingle();
    if (settings && !settings.ai_chat_enabled) return { ok: false as const, skipped: true };

    const { data: history, error } = await supabase
      .from("support_messages")
      .select("body, from_staff, created_at")
      .eq("student_id", userId)
      .order("created_at", { ascending: false })
      .limit(16);
    if (error) throw error;
    const msgs = (history ?? []).reverse();
    const last = msgs[msgs.length - 1];
    if (!last || last.from_staff) return { ok: false as const, skipped: true };

    const contents: { role: string; parts: unknown[] }[] = [];
    for (const m of msgs) {
      const role = m.from_staff ? "model" : "user";
      let part: unknown;
      if (AUDIO_RE.test(m.body)) {
        if (m === last && m.body.includes("/storage/v1/object/sign/media/")) {
          const audio = await fetch(m.body);
          if (!audio.ok) throw new Error("Voice message load nahi hua.");
          const mime = (audio.headers.get("content-type") || "audio/webm").split(";")[0];
          part = { inlineData: { mimeType: mime, data: toBase64(await audio.arrayBuffer()) } };
          contents.push({ role, parts: [part, { text: "(Student sent this voice message. Understand it and reply.)" }] });
          continue;
        }
        part = { text: "[voice message]" };
      } else if (IMAGE_RE.test(m.body)) part = { text: "[photo]" };
      else part = { text: m.body };
      const prev = contents[contents.length - 1];
      if (prev && prev.role === role) prev.parts.push(part);
      else contents.push({ role, parts: [part] });
    }
    if (contents[0]?.role === "model") contents.shift();

    const out = await geminiAny(["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"], { systemInstruction: { parts: [{ text: SYSTEM }] }, contents }, key);
    const reply = out.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    if (!reply) return { ok: false as const, error: "AI reply khaali aaya." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows: { student_id: string; sender_id: string; body: string; from_staff: boolean; is_ai: boolean }[] = [];

    // Voice reply for voice input — free TTS tier; falls back to text only.
    if (AUDIO_RE.test(last.body)) {
      try {
        const tts = await geminiAny(["gemini-3.8-flash-lite-tts", "gemini-2.5-flash-preview-tts"], {
          contents: [{ parts: [{ text: reply.slice(0, 1500) }] }],
          generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } },
        }, key);
        const inline = tts.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
        const b64 = inline?.data;
        if (b64) {
          const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const isWav = /wav/i.test(inline?.mimeType ?? "");
          const path = `chat-attachments/${userId}/ai-voice-${Date.now()}.wav`;
          const up = await supabaseAdmin.storage.from("media").upload(path, isWav ? raw : pcmToWav(raw), { contentType: "audio/wav" });
          if (!up.error) {
            const { data: signed } = await supabaseAdmin.storage.from("media").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
            if (signed) rows.push({ student_id: userId, sender_id: userId, body: signed.signedUrl, from_staff: true, is_ai: true });
          }
        }
      } catch (e) {
        console.error("TTS fallback to text", e);
      }
    }
    rows.push({ student_id: userId, sender_id: userId, body: reply, from_staff: true, is_ai: true });

    const ins = await supabaseAdmin.from("support_messages").insert(rows);
    if (ins.error) throw ins.error;
    return { ok: true as const };
  });
