import { fetchResultByToken } from "./api.js";
import {
  escapeHtml,
  formatDate,
  loadJson,
  readTokenFromUrl,
  sanitizeFileSegment,
} from "./utils.js";

const resultRoot = document.querySelector("#resultApp");

const dataUrls = {
  app: "data/app.json",
  profiles: "data/profiles.json",
  cta: "data/cta.json",
};

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  renderLoadingState("Buscando tu resultado...");

  const token = readTokenFromUrl();

  if (!token) {
    renderErrorState("Falta el token del resultado. Revisa el enlace recibido.");
    return;
  }

  try {
    const [appConfig, profilesData, ctaData] = await Promise.all([
      loadJson(dataUrls.app),
      loadJson(dataUrls.profiles),
      loadJson(dataUrls.cta),
    ]);

    const response = await fetchResultByToken(appConfig, token);
    const record = response.record;
    const profile = profilesData.profiles[record.result];

    if (!profile) {
      throw new Error("El perfil configurado para este resultado no existe.");
    }

    renderResult(record, profile, ctaData.cta, appConfig);
  } catch (error) {
    renderErrorState(
      error.message ||
        "No fue posible recuperar tu resultado. Intenta nuevamente desde el enlace original.",
    );
  }
}

function renderResult(record, profile, cta, appConfig) {
  resultRoot.setAttribute("aria-busy", "false");

  const strengthsMarkup = profile.strengths
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  resultRoot.innerHTML = `
    <header class="result-page-header">

      <div class="result-meta">

        <div class="result-meta-item">
          <span class="meta-label">Nombre</span>
          <span class="meta-value">${escapeHtml(record.name)}</span>
        </div>

        <div class="result-meta-item">
          <span class="meta-label">Email</span>
          <span class="meta-value">${escapeHtml(record.email)}</span>
        </div>

        <div class="result-meta-item">
          <span class="meta-label">Fecha</span>
          <span class="meta-value">${formatDate(record.timestamp)}</span>
        </div>

      </div>

    </header>


    <section class="result-section result-section--hero">
      <h1 class="result-profile-name">
        ${escapeHtml(profile.label)}
      </h1>

      <p class="result-profile-description">
        ${escapeHtml(profile.description)}
      </p>

    </section>


    <section class="result-section">

      <p class="result-intro">
        Si este perfil te representa, probablemente alguna vez pensaste:
      </p>

      <blockquote class="profile-quote">
        “${escapeHtml(profile.characteristicStatement)}”
      </blockquote>

    </section>


    <section class="result-section">

      <h2>Lo que mejor haces</h2>

      <ul class="bullet-list">
        ${strengthsMarkup}
      </ul>

    </section>


    <section class="result-section">

      <h2>Lo que podría frenarte</h2>

      <p class="section-copy">
        ${escapeHtml(profile.primaryRisk)}
      </p>

    </section>


    <section class="result-section">

      <h2>Lo que probablemente todavía no estés aprovechando</h2>

      <p class="section-copy">
        ${escapeHtml(profile.underutilizedOpportunities)}
      </p>

    </section>


    <section class="result-section">

      <h2>Qué te conviene aprender ahora</h2>

      <p class="section-copy">
        ${escapeHtml(profile.nextLearningStep)}
      </p>

    </section>


    <section class="result-section result-section--cta">

      <p class="screen-kicker">
        ${escapeHtml(cta.kicker)}
      </p>

      <h2>
        ${escapeHtml(cta.title)}
      </h2>

      <p class="section-copy">
        ${escapeHtml(cta.description)}
      </p>

      <div class="cta-links">
        <a
          class="cta-link"
          href="${escapeHtml(cta.instagram.url)}"
          target="_blank"
          rel="noreferrer">

          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
            <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/>
            <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/>
          </svg>

          ${escapeHtml(cta.instagram.label)}

        </a>

        <span class="cta-divider">•</span>

        <a
          class="cta-link"
          href="${escapeHtml(cta.facebook.url)}"
          target="_blank"
          rel="noreferrer">

          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M14 8h2V5h-2c-2.2 0-4 1.8-4 4v2H8v3h2v5h3v-5h2.3l.7-3H13V9c0-.6.4-1 1-1z"/>
          </svg>

          ${escapeHtml(cta.facebook.label)}

        </a>

        <span class="cta-divider">•</span>

        <a
          class="cta-link"
          href="${escapeHtml(cta.webSite.url)}"
          target="_blank"
          rel="noreferrer">

          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M3 12h18" stroke="currentColor" stroke-width="2"/>
            <path d="M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"
                  stroke="currentColor"
                  stroke-width="2"/>
          </svg>

          ${escapeHtml(cta.webSite.label)}

        </a>

      </div>

    </section>


    <section class="result-section result-section--download">

      <button
        type="button"
        class="button"
        id="downloadPdf">

        Descargar informe en PDF

      </button>

    </section>
  `;

  document
    .querySelector("#downloadPdf")
    ?.addEventListener("click", () => {
      downloadPdf(record, profile, appConfig);
    });
}

function downloadPdf(record, profile, appConfig) {
  if (!window.jspdf?.jsPDF) {
    renderErrorState("La librería de PDF todavía no está disponible. Intenta nuevamente en unos segundos.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const documentPdf = new jsPDF({
    unit: "pt",
    format: "a4",
  });

  const pageWidth = documentPdf.internal.pageSize.getWidth();
  const pageHeight = documentPdf.internal.pageSize.getHeight();
  const marginX = 52;
  const usableWidth = pageWidth - marginX * 2;
  let cursorY = 62;

  documentPdf.setFont("helvetica", "bold");
  documentPdf.setFontSize(22);
  documentPdf.text("Informe de perfil de uso de IA", marginX, cursorY);
  cursorY += 28;

  documentPdf.setFont("helvetica", "normal");
  documentPdf.setFontSize(11);
  const metaLines = [
    `Nombre: ${record.name}`,
    `Email: ${record.email}`,
    `País: ${record.country || "No disponible"}`,
    `Fecha de generación: ${formatDate(record.timestamp)}`,
  ];
  metaLines.forEach((line) => {
    documentPdf.text(line, marginX, cursorY);
    cursorY += 18;
  });

  cursorY += 14;
  cursorY = writeSection(documentPdf, "Perfil", profile.label, cursorY, marginX, usableWidth, pageHeight);
  cursorY = writeSection(documentPdf, "Descripción", profile.description, cursorY, marginX, usableWidth, pageHeight);
  cursorY = writeListSection(documentPdf, "Fortalezas", profile.strengths, cursorY, marginX, usableWidth, pageHeight);
  cursorY = writeSection(documentPdf, "Riesgo principal", profile.primaryRisk, cursorY, marginX, usableWidth, pageHeight);
  cursorY = writeSection(
    documentPdf,
    "Frase característica",
    profile.characteristicStatement,
    cursorY,
    marginX,
    usableWidth,
    pageHeight,
  );
  cursorY = writeSection(
    documentPdf,
    "Oportunidades poco aprovechadas",
    profile.underutilizedOpportunities,
    cursorY,
    marginX,
    usableWidth,
    pageHeight,
  );
  cursorY = writeSection(
    documentPdf,
    "Siguiente paso recomendado",
    profile.nextLearningStep,
    cursorY,
    marginX,
    usableWidth,
    pageHeight,
  );

  const pageCount = documentPdf.getNumberOfPages();
  const footerText = `Informe generado para: ${record.name} | ${record.email} | (${record.country || "Sin país"})`;

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    documentPdf.setPage(pageNumber);
    documentPdf.setFontSize(9);
    documentPdf.setTextColor(110, 118, 125);
    documentPdf.text(footerText, marginX, pageHeight - 24);
  }

  const filename = `${appConfig.pdf.fileNamePrefix}-${sanitizeFileSegment(record.name)}.pdf`;
  documentPdf.save(filename);
}

function writeSection(pdf, title, body, cursorY, marginX, usableWidth, pageHeight) {
  cursorY = ensurePageBreak(pdf, cursorY, pageHeight, 80);
  pdf.setTextColor(29, 42, 47);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(title, marginX, cursorY);
  cursorY += 18;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  const lines = pdf.splitTextToSize(body, usableWidth);
  pdf.text(lines, marginX, cursorY);
  cursorY += lines.length * 14 + 16;
  return cursorY;
}

function writeListSection(pdf, title, items, cursorY, marginX, usableWidth, pageHeight) {
  cursorY = ensurePageBreak(pdf, cursorY, pageHeight, 90);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(29, 42, 47);
  pdf.text(title, marginX, cursorY);
  cursorY += 18;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);

  items.forEach((item) => {
    cursorY = ensurePageBreak(pdf, cursorY, pageHeight, 50);
    const lines = pdf.splitTextToSize(`• ${item}`, usableWidth);
    pdf.text(lines, marginX, cursorY);
    cursorY += lines.length * 14 + 8;
  });

  return cursorY + 8;
}

function ensurePageBreak(pdf, cursorY, pageHeight, requiredSpace) {
  if (cursorY + requiredSpace <= pageHeight - 44) {
    return cursorY;
  }

  pdf.addPage();
  return 62;
}

function renderLoadingState(message) {
  resultRoot.innerHTML = `
    <section class="result-card loading-state">
      <div>
        <div class="spinner" aria-hidden="true"></div>
        <p>${escapeHtml(message)}</p>
      </div>
    </section>
  `;
}

function renderErrorState(message) {
  resultRoot.setAttribute("aria-busy", "false");
  resultRoot.innerHTML = `
    <section class="result-card empty-state">
      <div>
        <h2>No fue posible mostrar tu resultado</h2>
        <p class="section-copy">${escapeHtml(message)}</p>
        <div class="button-row">
          <a class="button" href="index.html">Volver al test</a>
        </div>
      </div>
    </section>
  `;
}
