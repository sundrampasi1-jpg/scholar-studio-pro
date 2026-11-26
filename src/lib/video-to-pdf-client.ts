type Notes = {
  title: string;
  overview: string;
  topics: { title: string; points: string[] }[];
  keyFacts: string[];
  visualHighlights: { timestamp: string; detail: string }[];
  questions: { question: string; answer: string }[];
  mcqs: { question: string; options: string[]; answer: string; explanation: string }[];
};

declare global {
  interface Window {
    html2PDF?: (
      element: HTMLElement,
      options?: Record<string, unknown>,
    ) => Promise<{ output: (type: "blob") => Blob }>;
    html2canvas?: (...args: any[]) => any;
    jspdf?: { jsPDF?: new (...args: any[]) => any };
  }
}

let html2PdfLoader: Promise<void> | null = null;

function loadScript(src: string, ready: () => boolean): Promise<void> {
  if (ready()) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const existing = Array.from(document.scripts).find((script) => script.src === src);
    const script = existing ?? document.createElement("script");
    const onLoad = () => ready()
      ? resolve()
      : reject(new Error("A required PDF library did not initialize."));
    const onError = () => reject(new Error("Could not load a PDF rendering library. Check your internet connection."));
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (!existing) {
      script.src = src;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

function loadHtml2Pdf() {
  if (typeof window === "undefined") return Promise.reject(new Error("PDF generation requires a browser."));
  if (window.html2PDF && window.html2canvas && window.jspdf?.jsPDF) return Promise.resolve();
  if (!html2PdfLoader) {
    html2PdfLoader = (async () => {
      // html2pdf.js bundles html2canvas 1.4.1, which cannot parse Tailwind v4
      // oklch() colors. Use the maintained html2canvas-pro renderer instead.
      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/3.0.4/jspdf.umd.min.js",
        () => !!window.jspdf?.jsPDF,
      );
      await loadScript(
        "https://cdn.jsdelivr.net/npm/html2canvas-pro@2.6.4/dist/html2canvas-pro.min.js",
        () => typeof window.html2canvas === "function",
      );
      await loadScript(
        "https://cdn.jsdelivr.net/npm/jspdf-html2canvas@1.7.0/dist/jspdf-html2canvas.min.js",
        () => typeof window.html2PDF === "function",
      );
    })().catch((error) => {
      html2PdfLoader = null;
      throw error;
    });
  }
  return html2PdfLoader;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]!);
}

export async function buildVideoNotesPdf(notes: Notes, lessonTitle: string): Promise<Blob> {
  await withTimeout(loadHtml2Pdf(), 30_000, "PDF library is taking too long to load. Check your internet and retry.");

  if (!document.querySelector('link[data-jk-hindi-font="true"]')) {
    const fontLink = document.createElement("link");
    fontLink.rel = "stylesheet";
    fontLink.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap";
    fontLink.dataset["jkHindiFont"] = "true";
    document.head.appendChild(fontLink);
  }
  await withTimeout(document.fonts.ready, 12_000, "Hindi font loading timed out. Please retry; the PDF can use the device fallback font.");
  try {
    await document.fonts.load('12px "Noto Sans Devanagari"');
  } catch {
    // The browser's native Devanagari fallback remains available.
  }

  const topics = notes.topics.map((topic) => `
    <section class="topic">
      <h3>${escapeHtml(topic.title)}</h3>
      <ul>${topic.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>
    </section>`).join("");
  const facts = notes.keyFacts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("");
  const visuals = notes.visualHighlights.map((item) => `<li><strong>${escapeHtml(item.timestamp)}</strong> — ${escapeHtml(item.detail)}</li>`).join("");
  const questions = notes.questions.map((item, index) => `
    <section class="qa">
      <p><strong>${index + 1}. ${escapeHtml(item.question)}</strong></p>
      <p><b>Answer / उत्तर:</b> ${escapeHtml(item.answer)}</p>
    </section>`).join("");
  const mcqs = notes.mcqs.map((item, index) => `
    <section class="mcq">
      <p><strong>${index + 1}. ${escapeHtml(item.question)}</strong></p>
      <ol type="A">${item.options.map((option) => `<li>${escapeHtml(option.replace(/^[A-D]\.\s*/, ""))}</li>`).join("")}</ol>
      <p><b>Correct answer / सही उत्तर:</b> ${escapeHtml(item.answer)}</p>
      <p><b>Explanation / व्याख्या:</b> ${escapeHtml(item.explanation)}</p>
    </section>`).join("");

  const root = document.createElement("div");
  root.id = "jk-pdf-render-root";
  root.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff;color:#172033;z-index:-1;";
  root.innerHTML = `
    <style id="jk-pdf-render-styles">
      .jk-pdf{box-sizing:border-box;width:794px;padding:42px 48px;background:#fff;color:#172033;font-family:"Noto Sans Devanagari",Arial,sans-serif;font-size:12px;line-height:1.65;overflow-wrap:anywhere}
      .jk-pdf h1{font-size:23px;text-align:center;color:#14532d;margin:0 0 6px}
      .jk-pdf .subtitle{text-align:center;color:#64748b;font-size:10px;margin:0 0 24px}
      .jk-pdf h2{font-size:16px;color:#166534;border-bottom:1px solid #d1fae5;padding-bottom:5px;margin:22px 0 9px}
      .jk-pdf h3{font-size:13px;color:#1f2937;margin:12px 0 5px}
      .jk-pdf p{margin:5px 0;white-space:pre-wrap}
      .jk-pdf ul,.jk-pdf ol{padding-left:24px;margin:5px 0 12px}
      .jk-pdf li{margin:3px 0}
      .jk-pdf .topic,.jk-pdf .qa,.jk-pdf .mcq{break-inside:avoid;page-break-inside:avoid;margin:0 0 10px}
      .jk-pdf .foot{margin-top:24px;padding-top:10px;border-top:1px solid #e5e7eb;color:#64748b;font-size:9px;text-align:center}
    </style>
    <article class="jk-pdf">
      <h1>JK ACADEMY</h1>
      <p class="subtitle">Bilingual Video-Based Exam Notes · Hindi + English</p>
      <h2>${escapeHtml(notes.title || lessonTitle)}</h2>
      <h2>Overview / सारांश</h2>
      <p>${escapeHtml(notes.overview)}</p>
      <h2>Topics Covered / सभी विषय</h2>
      ${topics}
      <h2>Important Facts / महत्वपूर्ण तथ्य</h2>
      <ul>${facts}</ul>
      ${visuals ? `<h2>Slides, Diagrams & Visual Highlights / दृश्य सामग्री</h2><ul>${visuals}</ul>` : ""}
      <h2>Important Questions & Answers / प्रश्न-उत्तर</h2>
      ${questions}
      <h2>Practice MCQs / बहुविकल्पीय प्रश्न</h2>
      ${mcqs}
      <p class="foot">Prepared from the lesson video for study support. Verify important current-affairs facts with official sources.</p>
    </article>`;
  document.body.appendChild(root);
  try {
    const pdfDocument = await withTimeout(
      window.html2PDF!(root, {
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        html2canvas: {
          scale: 1.5,
          useCORS: true,
          backgroundColor: "#ffffff",
          windowWidth: 794,
          scrollX: 0,
          scrollY: -window.scrollY,
          onclone: (clonedDoc: Document) => {
            const pdfStyles = clonedDoc.querySelector("#jk-pdf-render-styles")?.textContent || "";
            clonedDoc.querySelectorAll('style, link[rel="stylesheet"]:not([data-jk-hindi-font="true"])').forEach((element) => element.remove());

            const safeStyle = clonedDoc.createElement("style");
            safeStyle.textContent = pdfStyles;
            clonedDoc.head.appendChild(safeStyle);

            clonedDoc.body.style.cssText = "margin:0;padding:0;background:#fff;color:#172033;";
            clonedDoc.querySelectorAll<HTMLElement>("#jk-pdf-render-root").forEach((element) => {
              element.style.cssText = "position:static;width:794px;margin:0;padding:0;background:#fff;color:#172033;";
            });
          },
        },
        imageType: "image/jpeg",
        imageQuality: 0.96,
        margin: { top: 8, right: 8, bottom: 8, left: 8 },
        autoResize: true,
        success: () => undefined,
      }),
      90_000,
      "PDF rendering took too long. Please retry with a shorter lesson video.",
    );
    const pdf = pdfDocument.output("blob");
    if (!(pdf instanceof Blob) || pdf.size < 500) throw new Error("The PDF file could not be created.");
    return pdf;
  } finally {
    root.remove();
  }
}
