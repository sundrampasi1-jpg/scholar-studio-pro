import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Circle, Loader2, Square, Upload } from "lucide-react";
import { uploadMedia } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Pick a file, paste a link, or (for video) record from camera/screen.
 * Uploads go to cloud storage; the resulting link is returned via onChange.
 */
export function MediaInput({
  value,
  onChange,
  kind,
  folder,
}: {
  value: string;
  onChange: (url: string) => void;
  kind: "video" | "pdf" | "image";
  folder: string;
}) {
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  const accept = kind === "video" ? "video/*" : kind === "pdf" ? "application/pdf" : "image/*";

  async function doUpload(file: File | Blob, name?: string) {
    setBusy(true);
    try {
      const url = await uploadMedia(file, folder, name);
      onChange(url);
      toast.success("Uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function startRecording(source: "camera" | "screen") {
    try {
      const stream =
        source === "screen"
          ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
          : await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      chunks.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: "video/webm" });
        void doUpload(blob, `recording-${Date.now()}.webm`);
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch {
      toast.error("Could not access camera/screen. Check browser permissions.");
    }
  }

  function stopRecording() {
    recRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="space-y-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={kind === "video" ? "Paste YouTube/Vimeo/video link, or upload" : "Paste link, or upload"}
      />
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent">
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
          {busy ? "Uploading…" : "Upload file"}
          <input
            type="file"
            accept={accept}
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doUpload(f);
              e.target.value = "";
            }}
          />
        </label>
        {kind === "video" &&
          (recording ? (
            <Button type="button" size="sm" variant="destructive" onClick={stopRecording}>
              <Square className="mr-1.5 h-4 w-4" /> Stop & upload
            </Button>
          ) : (
            <>
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => startRecording("camera")}>
                <Circle className="mr-1.5 h-4 w-4 text-primary" /> Record camera
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => startRecording("screen")}>
                <Circle className="mr-1.5 h-4 w-4 text-primary" /> Record screen
              </Button>
            </>
          ))}
        {value && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>
            Remove
          </Button>
        )}
      </div>
      {value && kind === "video" && !/youtu|vimeo/.test(value) && (
        <video src={value} controls className="max-h-48 w-full rounded-md bg-black" />
      )}
    </div>
  );
}
