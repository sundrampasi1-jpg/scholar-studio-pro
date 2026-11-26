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
    html2pdf?: () => any;
  }
}

let html2PdfLoader: Promise<void> | null = null;

function withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), milliseconds);
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error) => { window.clearTimeout(timer); reject(error); },
    );
  });
}

function loadHtml2Pdf() {
  if (typeof window === "undefined") return Promise.reject(new Error("PDF generation requires a browser."));
  if (window.html2pdf) return Promise.resolve();
  if (!html2PdfLoader) {
    html2PdfLoader = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.3/html2pdf.bundle.min.js";
      script.async = true;
      script.onload = () => window.html2pdf ? resolve() : reject(new Error("PDF library did not initialize."));
      script.onerror = () => reject(new Error("Could not load the PDF generator. Check your internet connection."));
      document.head.appendChild(script);
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
    const worker = window.html2pdf!().set({
      margin: [8, 8, 8, 8],
      image: { type: "jpeg", quality: 0.96 },
      html2canvas: {
        scale: 1.5,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: 794,
        // html2canvas cannot parse the app's Tailwind oklch colors. Render this
        // self-contained PDF document without inheriting the app-wide styles.
        onclone: (clonedDoc: Document) => {
          // Strip every app stylesheet from the cloned document, not just head
          // styles. Some app/theme styles are injected outside head and contain
          // oklch(), which html2canvas cannot parse.
          const pdfStyles = clonedDoc.querySelector("#jk-pdf-render-styles")?.textContent || "";
          clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((element) => element.remove());

          const safeStyle = clonedDoc.createElement("style");
          safeStyle.textContent = pdfStyles;
          clonedDoc.head.appendChild(safeStyle);

          clonedDoc.body.style.cssText = "margin:0;padding:0;background:#fff;color:#172033;";
          clonedDoc.querySelectorAll<HTMLElement>("#jk-pdf-render-root").forEach((element) => {
            element.style.cssText = "position:static;width:794px;margin:0;padding:0;background:#fff;color:#172033;";
          });
        },
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    }).from(root);
    const pdf = await withTimeout(worker.outputPdf("blob"), 90_000, "PDF rendering took too long. Please retry with a shorter lesson video.");
    if (!(pdf instanceof Blob) || pdf.size < 500) throw new Error("The PDF file could not be created.");
    return pdf;
  } finally {
    root.remove();
  }
}
