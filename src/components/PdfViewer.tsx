 import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

async function fetchPdfBytes(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return new Uint8Array(await res.arrayBuffer());
}

export function PdfViewer({ url, className }: { url: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const pdfDocRef = useRef<any>(null);
  const renderedPages = useRef<Set<number>>(new Set());
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    renderedPages.current.clear();
    pageRefs.current.clear();
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const data = await fetchPdfBytes(url);
        if (cancelled) return;
        const doc = await pdfjs.getDocument({ data }).promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setState("ready");
      } catch (e) {
        console.error("PDF load failed", e);
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
      pdfDocRef.current = null;
    };
  }, [url, attempt]);

  async function renderPage(pageNum: number) {
    if (renderedPages.current.has(pageNum)) return;
    const doc = pdfDocRef.current;
    const host = pageRefs.current.get(pageNum);
    if (!doc || !host) return;
    renderedPages.current.add(pageNum);
    try {
      const page = await doc.getPage(pageNum);
      const base = page.getViewport({ scale: 1 });
      const fitWidth = Math.min(host.parentElement?.clientWidth || window.innerWidth || 800, 1000) - 8;
      const width = Math.max(200, fitWidth) * zoom;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const scale = width / base.width;
      const vp = page.getViewport({ scale: scale * ratio });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      canvas.style.width = Math.floor(width) + "px";
      canvas.style.maxWidth = zoom > 1 ? "none" : "100%";
      canvas.style.height = "auto";
      canvas.className = "mx-auto block rounded border bg-card shadow-sm";
      host.innerHTML = "";
      host.appendChild(canvas);
      await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
    } catch (e) {
      console.error("Page render failed", pageNum, e);
      renderedPages.current.delete(pageNum);
    }
  }

  useEffect(() => {
    if (state !== "ready" || !containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const pageNum = Number((entry.target as HTMLElement).dataset["page"]);
            if (pageNum) renderPage(pageNum);
          }
        }
      },
      { root: null, rootMargin: "600px 0px", threshold: 0.01 }
    );
    pageRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [state, numPages, zoom]);

  useEffect(() => {
    renderedPages.current.clear();
    pageRefs.current.forEach((host) => {
      host.innerHTML = "";
    });
  }, [zoom]);

  return (
    <div className={className}>
      {state === "loading" && (
        <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening PDF…
        </p>
      )}
      {state === "error" && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Could not show this PDF.{" "}
          <button type="button" className="font-medium text-primary underline" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </button>
        </p>
      )}
      {state === "ready" && numPages > 0 && (
        <div className="sticky top-0 z-10 mb-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <button type="button" className="rounded border bg-card px-2 py-1" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} aria-label="Zoom out">
            −
          </button>
          <span>
            {Math.round(zoom * 100)}% · {numPages} pages
          </span>
          <button type="button" className="rounded border bg-card px-2 py-1" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} aria-label="Zoom in">
            +
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <div ref={containerRef} className="mx-auto">
          {state === "ready" &&
            Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <div
                key={pageNum}
                data-page={pageNum}
                ref={(el) => {
                  if (el) pageRefs.current.set(pageNum, el);
                }}
                className="mb-3 flex min-h-[300px] items-center justify-center"
              >
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export async function downloadFile(url: string, title: string) {
  const id = toast.loading("Downloading…");
  try {
    const bytes = await fetchPdfBytes(url);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const name = title.replace(/[^\w.-]+/g, "_") + (title.toLowerCase().endsWith(".pdf") ? "" : ".pdf");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    try {
      const raw = localStorage.getItem("jk_downloads");
      const list = raw ? JSON.parse(raw) : [];
      list.unshift({ title, downloadedAt: new Date().toISOString() });
      localStorage.setItem("jk_downloads", JSON.stringify(list.slice(0, 100)));
    } catch {}
    toast.success("Saved to your downloads", { id });
  } catch {
    toast.error("Download failed. Check your connection and try again.", { id });
  }
    }
