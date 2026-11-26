import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function PdfViewer({ url, className }: { url: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [pageRatio, setPageRatio] = useState(1.414);
  const pdfDocRef = useRef<any>(null);
  const renderedPages = useRef<Set<number>>(new Set());
  const renderingPages = useRef<Set<number>>(new Set());
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const renderTasks = useRef<Map<number, any>>(new Map());
  const queue = useRef<number[]>([]);
  const activeRenders = useRef(0);
  const pumpRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setNumPages(0);
    renderedPages.current.clear();
    renderingPages.current.clear();
    pageRefs.current.clear();
    queue.current = [];
    activeRenders.current = 0;

    (async () => {
      let loadingTask: any;
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        // Bundle the worker with the app so PDF rendering does not depend on a third-party CDN.
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        // Let PDF.js request byte ranges progressively instead of downloading the
        // entire document into memory before the first page can appear.
        loadingTask = pdfjs.getDocument({
          url,
          rangeChunkSize: 65536,
          disableRange: false,
          disableStream: false,
          disableAutoFetch: false,
        });
        const doc = await loadingTask.promise;
        if (cancelled) {
          await doc.destroy();
          return;
        }
        pdfDocRef.current = doc;
        const firstPage = await doc.getPage(1);
        const firstViewport = firstPage.getViewport({ scale: 1 });
        if (!cancelled && firstViewport.width > 0) {
          setPageRatio(firstViewport.height / firstViewport.width);
        }
        firstPage.cleanup();
        setNumPages(doc.numPages);
        setState("ready");
      } catch (e) {
        console.error("PDF load failed", e);
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
      renderTasks.current.forEach((task) => {
        try { task.cancel(); } catch {}
      });
      renderTasks.current.clear();
      queue.current = [];
      renderingPages.current.clear();
      const doc = pdfDocRef.current;
      pdfDocRef.current = null;
      if (doc) void doc.destroy().catch(() => {});
      else if (loadingTask) void loadingTask.destroy().catch(() => {});
    };
  }, [url, attempt]);

  useEffect(() => {
    if (state !== "ready" || !containerRef.current) return;

    let disposed = false;
    const processPage = async (pageNum: number) => {
      const doc = pdfDocRef.current;
      const host = pageRefs.current.get(pageNum);
      if (!doc || !host || disposed) return;
      try {
        const page = await doc.getPage(pageNum);
        if (disposed || !host.isConnected) {
          page.cleanup();
          return;
        }
        const base = page.getViewport({ scale: 1 });
        const fitWidth = host.parentElement?.clientWidth || window.innerWidth || 800;
        const width = Math.max(200, fitWidth) * zoom;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
        const scale = (width / base.width) * pixelRatio;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = Math.ceil(width) + "px";
        canvas.style.maxWidth = zoom > 1 ? "none" : "100%";
        canvas.style.height = "auto";
        canvas.className = "mx-auto block bg-card";
        host.replaceChildren(canvas);
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Canvas is unavailable");
        const task = page.render({ canvasContext: context, viewport });
        renderTasks.current.set(pageNum, task);
        await task.promise;
        renderedPages.current.add(pageNum);
        page.cleanup();
      } catch (e: any) {
        if (e?.name !== "RenderingCancelledException") {
          console.error("Page render failed", pageNum, e);
          const host = pageRefs.current.get(pageNum);
          if (host?.isConnected) {
            const canvas = host.querySelector("canvas");
            if (canvas) canvas.remove();
          }
        }
      } finally {
        renderTasks.current.delete(pageNum);
        renderingPages.current.delete(pageNum);
      }
    };

    const pump = () => {
      while (!disposed && activeRenders.current < 2 && queue.current.length) {
        const pageNum = queue.current.shift()!;
        activeRenders.current += 1;
        void processPage(pageNum).finally(() => {
          activeRenders.current = Math.max(0, activeRenders.current - 1);
          pump();
        });
      }
    };
    pumpRef.current = pump;

    const schedulePage = (pageNum: number) => {
      if (
        pageNum < 1 ||
        pageNum > numPages ||
        renderedPages.current.has(pageNum) ||
        renderingPages.current.has(pageNum)
      ) return;
      renderingPages.current.add(pageNum);
      queue.current.push(pageNum);
      pump();
    };

    // Observe against the actual scrollable ancestor, not always the viewport.
    let scrollRoot: HTMLElement | null = containerRef.current.parentElement;
    while (scrollRoot && scrollRoot !== document.body) {
      const overflowY = window.getComputedStyle(scrollRoot).overflowY;
      if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") break;
      scrollRoot = scrollRoot.parentElement;
    }
    if (scrollRoot === document.body) scrollRoot = null;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => Number((entry.target as HTMLElement).dataset.page))
          .filter((pageNum) => Number.isFinite(pageNum));
        // Prioritize pages nearest the current viewport.
        visible.sort((a, b) => a - b);
        visible.forEach(schedulePage);
      },
      { root: scrollRoot, rootMargin: "900px 0px", threshold: 0.01 }
    );

    pageRefs.current.forEach((el) => observer.observe(el));
    // Start rendering immediately; the observer will queue the remaining pages as needed.
    schedulePage(1);
    schedulePage(2);

    return () => {
      disposed = true;
      observer.disconnect();
      queue.current = [];
      renderTasks.current.forEach((task) => {
        try { task.cancel(); } catch {}
      });
      renderTasks.current.clear();
      renderingPages.current.clear();
      pumpRef.current = () => {};
    };
  }, [state, numPages, zoom]);

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
          <span>{Math.round(zoom * 100)}% · {numPages} pages</span>
          <button type="button" className="rounded border bg-card px-2 py-1" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} aria-label="Zoom in">
            +
          </button>
        </div>
      )}
      <div className="w-full overflow-x-auto">
        <div ref={containerRef} className="w-full">
          {state === "ready" &&
            Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <div
                key={pageNum}
                data-page={pageNum}
                ref={(el) => {
                  if (el) pageRefs.current.set(pageNum, el);
                  else pageRefs.current.delete(pageNum);
                }}
                style={{ aspectRatio: `1 / ${pageRatio}` }}
                className="flex w-full items-center justify-center overflow-hidden"
              >
                {!renderedPages.current.has(pageNum) && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
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
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const bytes = await res.arrayBuffer();
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
