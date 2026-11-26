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

function withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), milliseconds);
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error) => { window.clearTimeout(timer); reject(error); },
    );
  });
}

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
        "https://cdn.jsdelivr.net/npm/jspdf@4.2.0/dist/jspdf.umd.min.js",
        () => !!window.jspdf?.jsPDF,
      );
      await loadScript(
        "https://cdn.jsdelivr.net/npm/html2canvas-pro@1.6.7/dist/html2canvas-pro.min.js",
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

  const pickLanguage = (value: string, language: "hi" | "en") => {
    const text = String(value || "").replace(/\r/g, "").trim();
    const normalized = text
      .replace(/\s*\|\s*(?=(?:Hindi|English)\s*:)/gi, "\n")
      .replace(/\s+(?=(?:Hindi|English)\s*:)/gi, "\n");
    const hindi = normalized.match(/(?:^|\n)\s*Hindi\s*:\s*([\s\S]*?)(?=\n\s*English\s*:|$)/i)?.[1]?.trim();
    const english = normalized.match(/(?:^|\n)\s*English\s*:\s*([\s\S]*?)(?=\n\s*Hindi\s*:|$)/i)?.[1]?.trim();
    if (hindi || english) return (language === "hi" ? hindi : english) || "";
    const devanagari = normalized.match(/(?:^|\n)\s*हिंदी\s*[:：-]\s*([\s\S]*?)(?=\n\s*(?:English|अंग्रेज़ी)\s*[:：-]|$)/i)?.[1]?.trim();
    const englishAlt = normalized.match(/(?:^|\n)\s*(?:English|अंग्रेज़ी)\s*[:：-]\s*([\s\S]*?)(?=\n\s*हिंदी\s*[:：-]|$)/i)?.[1]?.trim();
    if (devanagari || englishAlt) return (language === "hi" ? devanagari : englishAlt) || "";
    const slashParts = text.split(/\s+\/\s+/);
    if (slashParts.length === 2) return slashParts[language === "hi" ? 0 : 1].trim();
    return text;
  };

  const englishOptionNames: Record<string, string> = {
    "यमुना": "Yamuna", "गंगा": "Ganga", "दामोदर": "Damodar", "दामोदर नदी": "Damodar River",
    "छोटा नागपुर का पठार": "Chota Nagpur Plateau", "अमरकंटक": "Amarkantak", "त्र्यंबकेश्वर": "Trimbakeshwar",
    "शिवालिक पहाड़ियाँ": "Shivalik Hills", "शिवालिक पहाड़ियाँ": "Shivalik Hills", "छोटा नागपुर पठार": "Chota Nagpur Plateau",
    "सरस्वती": "Saraswati", "ब्रह्मपुत्र": "Brahmaputra", "गोदावरी": "Godavari", "कृष्णा": "Krishna",
    "कावेरी": "Kaveri", "महानदी": "Mahanadi", "लूनी": "Luni", "साबरमती": "Sabarmati",
    "नर्मदा": "Narmada", "ताप्ती": "Tapti", "तापी": "Tapti", "बराकर": "Barakar",
    "बराकर नदी": "Barakar River", "कोनार": "Konar", "कोनार नदी": "Konar River",
    "जामुनिया": "Jamunia", "जामुनिया नदी": "Jamunia River", "सोन": "Son",
    "चंबल": "Chambal", "बेतवा": "Betwa", "रूस": "Russia", "ब्रिटेन": "Britain",
    "अमेरिका": "America", "फ्रांस": "France", "झारखंड": "Jharkhand",
    "पश्चिम बंगाल": "West Bengal", "बिहार": "Bihar", "छोटा नागपुर पठार": "Chota Nagpur Plateau",
    "तिलैया बांध": "Tilaiya Dam", "मैथन बांध": "Maithon Dam", "पंचेत हिल बांध": "Panchet Hill Dam",
  };
  const renderOption = (value: string, language: "hi" | "en") => {
    const cleaned = value.replace(/^[A-D]\.\s*/, "").trim();
    const bilingual = pickLanguage(cleaned, language);
    if (bilingual !== cleaned) return bilingual;
    return language === "en" ? (englishOptionNames[cleaned] || cleaned) : cleaned;
  };

  const renderLanguage = (language: "hi" | "en") => {
    const hindi = language === "hi";
    const heading = (hi: string, en: string) => hindi ? hi : en;
    const topics = notes.topics.map((topic) => `
      <section class="topic">
        <h3>${escapeHtml(pickLanguage(topic.title, language) || topic.title)}</h3>
        <ul>${topic.points.map((point) => `<li>${escapeHtml(pickLanguage(point, language) || point)}</li>`).join("")}</ul>
      </section>`).join("");
    const facts = notes.keyFacts.map((fact) => `<li>${escapeHtml(pickLanguage(fact, language) || fact)}</li>`).join("");
    const visuals = notes.visualHighlights.map((item) => `<li><strong>${escapeHtml(item.timestamp)}</strong> — ${escapeHtml(pickLanguage(item.detail, language) || item.detail)}</li>`).join("");
    const questions = notes.questions.map((item, index) => `
      <section class="qa">
        <p><strong>${index + 1}. ${escapeHtml(pickLanguage(item.question, language) || item.question)}</strong></p>
        <p><b>${heading("उत्तर:", "Answer:")}</b> ${escapeHtml(pickLanguage(item.answer, language) || item.answer)}</p>
      </section>`).join("");
    const mcqs = notes.mcqs.map((item, index) => `
      <section class="mcq">
        <p><strong>${index + 1}. ${escapeHtml(pickLanguage(item.question, language) || item.question)}</strong></p>
        <ol type="A">${item.options.map((option) => `<li>${escapeHtml(renderOption(option, language))}</li>`).join("")}</ol>
        <p><b>${heading("सही उत्तर:", "Correct answer:")}</b> ${escapeHtml(item.answer)}</p>
        <p><b>${heading("व्याख्या:", "Explanation:")}</b> ${escapeHtml(pickLanguage(item.explanation, language) || item.explanation)}</p>
      </section>`).join("");
    return `
      <article class="jk-pdf language-section ${hindi ? "hindi-section" : "english-section"}">
        <h1 class="jk-brand">JK ACADEMY</h1>
        <p class="subtitle">${heading("वीडियो अध्ययन नोट्स", "Video Study Notes")}</p>
        <h2>${escapeHtml(pickLanguage(notes.title || lessonTitle, language) || notes.title || lessonTitle)}</h2>
        <h2>${heading("सारांश", "Overview")}</h2>
        <p>${escapeHtml(pickLanguage(notes.overview, language) || notes.overview)}</p>
        <h2>${heading("विषय-वस्तु", "Topics Covered")}</h2>
        ${topics}
        <h2>${heading("महत्वपूर्ण तथ्य", "Important Facts")}</h2>
        <ul>${facts}</ul>
        ${visuals ? `<h2>${heading("स्लाइड, चित्र और मुख्य दृश्य", "Slides, Diagrams & Visual Highlights")}</h2><ul>${visuals}</ul>` : ""}
        <h2>${heading("महत्वपूर्ण प्रश्न-उत्तर", "Important Questions & Answers")}</h2>
        ${questions}
        <h2>${heading("अभ्यास प्रश्न", "Practice MCQs")}</h2>
        ${mcqs}
        
      </article>`;
  };

  const root = document.createElement("div");
  root.id = "jk-pdf-render-root";
  root.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff;color:#172033;z-index:-1;";
  root.innerHTML = `
    <style id="jk-pdf-render-styles">
      .jk-pdf{box-sizing:border-box;width:794px;padding:46px 50px 54px;background:#fff;color:#172033;font-family:"Noto Sans Devanagari",Arial,sans-serif;font-size:20px;line-height:1.9;overflow-wrap:anywhere}
      .jk-pdf h1.jk-brand{font-family:Georgia,"Times New Roman",serif;font-size:34px;font-weight:900;letter-spacing:4px;text-align:center;color:#14532d;margin:0 0 7px;text-shadow:0 1px 0 #e8d4ad}
      .jk-pdf .subtitle{text-align:center;color:#64748b;font-size:16px;font-weight:600;letter-spacing:.5px;margin:0 0 26px}
      .jk-pdf h2{font-size:26px;color:#166534;border-bottom:1px solid #d1fae5;padding-bottom:6px;margin:24px 0 11px}
      .jk-pdf h3{font-size:23px;color:#1f2937;margin:15px 0 7px}
      .jk-pdf p{margin:7px 0;white-space:pre-wrap}
      .jk-pdf ul,.jk-pdf ol{padding-left:28px;margin:7px 0 15px}
      .jk-pdf li{margin:5px 0}
      .jk-pdf .topic,.jk-pdf .qa,.jk-pdf .mcq{break-inside:avoid;page-break-inside:avoid;margin:0 0 14px}
      .jk-pdf .english-section{break-before:page;page-break-before:always}
    </style>
    ${renderLanguage("hi")}
    ${renderLanguage("en")}`;
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
        // Reserve a dedicated footer band so the rule never crosses question text.
        margin: { top: 8, right: 8, bottom: 19, left: 8 },
        autoResize: true,
        success: () => undefined,
      }),
      90_000,
      "PDF rendering took too long. Please retry with a shorter lesson video.",
    );
    // Add a subtle branded footer rule to every physical PDF page.
    try {
      const pageCount = typeof (pdfDocument as any).getNumberOfPages === "function"
        ? (pdfDocument as any).getNumberOfPages()
        : 0;
      for (let page = 1; page <= pageCount; page += 1) {
        (pdfDocument as any).setPage(page);
        (pdfDocument as any).setDrawColor(199, 154, 75);
        (pdfDocument as any).setLineWidth(0.35);
        // Keep the decorative footer in the reserved bottom margin, below all page content.
        (pdfDocument as any).line(9, 291, 201, 291);
        (pdfDocument as any).setTextColor(20, 83, 45);
        (pdfDocument as any).setFont("times", "bold");
        (pdfDocument as any).setFontSize(7);
        (pdfDocument as any).text("JK ACADEMY", 105, 295, { align: "center", charSpace: 1.1 });
      }
    } catch (footerError) {
      console.warn("PDF decorative footer could not be added", footerError);
    }
    const pdf = pdfDocument.output("blob");
    if (!(pdf instanceof Blob) || pdf.size < 500) throw new Error("The PDF file could not be created.");
    return pdf;
  } finally {
    root.remove();
  }
}
