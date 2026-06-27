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
  const metaItems = [
    { label: "Nombre", value: record.name },
    { label: "Email", value: record.email },
    { label: "País", value: record.country || "" },
    { label: "Fecha de generación", value: formatDate(record.timestamp) },
  ].filter((item) => item.value);

  const strengthsMarkup = profile.strengths
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  resultRoot.setAttribute("aria-busy", "false");
  resultRoot.innerHTML = `
    <section class="result-card result-hero">
      <span class="hero-badge">Perfil asignado</span>
      <h2 class="result-title">${escapeHtml(profile.label)}</h2>
      <p class="section-copy">${escapeHtml(profile.description)}</p>
      <div class="meta-grid">
        ${metaItems
          .map(
            (item) => `
              <article class="meta-item">
                <span class="meta-label">${escapeHtml(item.label)}</span>
                <p class="meta-value">${escapeHtml(item.value)}</p>
              </article>
            `,
          )
          .join("")}
      </div>
      <div class="button-row">
        <button type="button" class="button" id="downloadPdf">Descargar PDF</button>
      </div>
    </section>

    <section class="result-card">
      <div class="detail-grid">
        <article class="detail-card">
          <h3 class="section-title">Fortalezas</h3>
          <ul class="bullet-list">${strengthsMarkup}</ul>
        </article>
        <article class="detail-card detail-card--accent">
          <h3 class="section-title">Riesgo principal</h3>
          <p class="section-copy">${escapeHtml(profile.primaryRisk)}</p>
        </article>
        <article class="detail-card">
          <h3 class="section-title">Frase característica</h3>
          <p class="section-copy">${escapeHtml(profile.characteristicStatement)}</p>
        </article>
        <article class="detail-card">
          <h3 class="section-title">Oportunidades poco aprovechadas</h3>
          <p class="section-copy">${escapeHtml(profile.underutilizedOpportunities)}</p>
        </article>
      </div>
    </section>

    <aside class="cta-card">
      <div>
        <p class="screen-kicker">${escapeHtml(cta.kicker)}</p>
        <h3 class="section-title">${escapeHtml(cta.title)}</h3>
        <p class="section-copy">${escapeHtml(cta.description)}</p>
      </div>
      <div class="detail-card">
        <h3 class="section-title">Siguiente paso recomendado</h3>
        <p class="section-copy">${escapeHtml(profile.nextLearningStep)}</p>
      </div>
      <div class="cta-actions">
        <a class="cta-button" href="${escapeHtml(cta.primaryButton.url)}" target="_blank" rel="noreferrer">
          ${escapeHtml(cta.primaryButton.label)}
        </a>
        <a class="button-ghost" href="${escapeHtml(cta.secondaryButton.url)}">
          ${escapeHtml(cta.secondaryButton.label)}
        </a>
      </div>
    </aside>
  `;

  document.querySelector("#downloadPdf")?.addEventListener("click", () => {
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
