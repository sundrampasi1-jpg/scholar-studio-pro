import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

/** Renders every page of a PDF as an image, page by page — works on phones and inside the Android app. */
export function PdfViewer({ url, className }: { url: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const host = ref.current;
    if (!host) return;
    host.innerHTML = "";
    setState("loading");
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const doc = await pdfjs.getDocument({ url }).promise;
        if (cancelled) return;
        setPages(doc.numPages);
        setState("ready");
        const width = Math.min(host.clientWidth || 800, 1000);
        for (let i = 1; i <= doc.numPages; i++) {
          if (cancelled) return;
          const page = await doc.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const ratio = window.devicePixelRatio || 1;
          const vp = page.getViewport({ scale: (width / base.width) * ratio });
          const canvas = document.createElement("canvas");
          canvas.width = vp.width;
          canvas.height = vp.height;
          canvas.style.width = "100%";
          canvas.className = "mb-3 rounded border bg-card shadow-sm";
          host.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, attempt]);

  return (
    <div className={className}>
      {state === "loading" && (
        <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening PDF…
        </p>
      )}
      {state === "error" && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Could not show this PDF here.{" "}
          <button type="button" className="font-medium text-primary underline" onClick={() => setAttempt((a) => a + 1)}>Try again</button>{" or "}
          <a href={url} target="_blank" rel="noreferrer" className="font-medium text-primary underline">
            Open it directly
          </a>
        </p>
      )}
      {state === "ready" && pages > 0 && (
        <div className="sticky top-0 z-10 mb-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <button type="button" className="rounded border bg-card px-2 py-1" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} aria-label="Zoom out">−</button>
          <span>{Math.round(zoom * 100)}% · {pages} pages</span>
          <button type="button" className="rounded border bg-card px-2 py-1" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} aria-label="Zoom in">+</button>
        </div>
      )}
      <div className="overflow-x-auto">
        <div ref={ref} className="mx-auto max-w-4xl" style={{ width: `${zoom * 100}%`, maxWidth: zoom > 1 ? "none" : undefined }} />
      </div>
    </div>
  );
}

/** Saves a file to the device (works for files stored online, not just same-site links). */
export async function downloadFile(url: string, title: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = title.replace(/[^\w.-]+/g, "_") + (title.toLowerCase().endsWith(".pdf") ? "" : ".pdf");
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch {
    window.open(url, "_blank");
  }
}
