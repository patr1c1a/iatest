import { fetchResultByToken } from "./api.js";
import {
  escapeHtml,
  formatDate,
  loadJson,
  readTokenFromUrl,
  sanitizeFileSegment,
} from "./utils.js";

const resultRoot = document.querySelector("#resultApp");

const PROFILE_ICONS = {
  explorador: "compass",
  desconfiado: "search",
  jefe: "target",
  minimalista: "zap",
  prudente: "shield-user",
};

const SECTION_ICONS = {
  strengths: "check",
  risk: "triangle-alert",
  opportunities: "lightbulb",
  learning: "move-up-right",
};

const dataUrls = {
  app: "data/app.json",
  profiles: "data/profiles.json",
  cta: "data/cta.json",
};

document.addEventListener("DOMContentLoaded", initialize);

function formatShortDate(timestamp) {
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

async function initialize() {
  renderLoadingState("Buscando tu resultado...");

  const token = readTokenFromUrl();

  if (!token) {
    renderErrorState(
      "Falta el token del resultado. Revisa el enlace recibido.",
    );
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
    .map(
      (item) => `
      <li>
        <span>${escapeHtml(item)}</span>
      </li>
    `,
    )
    .join("");

  resultRoot.innerHTML = `
    <header class="result-page-header">
      
        <div class="result-meta">
          <p class="result-meta-title">
            Resultado personalizado para:
          </p>

          <p class="result-meta-name">
            ${escapeHtml(record.name)}
          </p>

          <p class="result-meta-email">
            ${escapeHtml(record.email)} · ${formatShortDate(record.timestamp)}
          </p>
        </div>

        <hr>
    </header>

    <section class="result-section result-feature--success">
      <div class="profile-card">
        <div class="profile-card-icon">
          <i data-lucide="${PROFILE_ICONS[record.result]}"></i>
        </div>
        <p class="result-profile-kicker">
          Tu perfil de usuario de IA es:
        </p>

        <h1 class="result-profile-name">
          ${escapeHtml(profile.label)}
        </h1>
        <p class="result-profile-description">
          ${escapeHtml(profile.description)}
        </p>
      </div>
    </section>

    <section class="result-section">
      <p class="result-intro">
        Si este perfil te representa, probablemente alguna vez pensaste:
      </p>
      <blockquote class="profile-quote">
        “${escapeHtml(profile.characteristicStatement)}”
      </blockquote>
    </section>

    <section class="result-section result-feature result-feature--success">
      <div class="result-block-title success">
        <i data-lucide="${SECTION_ICONS.strengths}"></i>
        <h2>Lo que mejor haces</h2>
      </div>
      <ul class="bullet-list">
        ${strengthsMarkup}
      </ul>
    </section>

    <section class="result-section result-feature result-feature--warning">
      <div class="result-block-title warning">
        <i data-lucide="${SECTION_ICONS.risk}"></i>
        <h2>Lo que podría frenarte</h2>
      </div>
      <p class="section-copy">
        ${escapeHtml(profile.primaryRisk)}
      </p>
    </section>

    <section class="result-section result-feature result-feature--info">
      <div class="result-block-title info">
        <i data-lucide="${SECTION_ICONS.opportunities}"></i>
          <h2>Lo que posiblemente todavía no estés aprovechando</h2>
      </div>
      <p class="section-copy">
        ${escapeHtml(profile.underutilizedOpportunities)}
      </p>
    </section>

    <section class="result-section result-feature result-feature--learn">
      <div class="result-block-title learn">
        <i data-lucide="${SECTION_ICONS.learning}"></i>
        <h2>Qué te conviene aprender ahora</h2>
      </div>
      <p class="section-copy">
        ${escapeHtml(profile.nextLearningStep)}
      </p>
    </section>

    <section class="result-section download-card">
      <p class="download-card__title">
        Guarda tu resultado del test
      </p>
      <div class="download-actions">
        <button
          type="button"
          class="button download-action"
          id="downloadPdf">
          <i data-lucide="download"></i>
          <span>Descargar informe en PDF</span>
        </button>

        <button
          type="button"
          class="button-ghost download-action"
          id="copyPermanentLink">
          <i data-lucide="link"></i>
          <span>Copiar enlace permanente</span>
        </button>
      </div>
    </section>

    <section class="result-section result-section--cta">
      <p class="screen-kicker">
        ${escapeHtml(cta.kicker)}
      </p>
      <h3>
        ${escapeHtml(cta.title)}
      </h3>
      <p class="cta-description">
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
          <i data-lucide="globe"></i>
          ${escapeHtml(cta.webSite.label)}
        </a>
      </div>

      <a class="result-restart-link" href="index.html">
        ← Hacer nuevamente el test
      </a>
    </section>

    <div class="submission-success__share">
      <p class="submission-success__share-label">Compartir el test con alguien que debería descubrir su perfil:</p>
      <div class="share-actions">
        <a
          class="button-ghost share-button share-button--whatsapp"
          href="https://wa.me/?text=Completa%20el%20test%20gratuito%20para%20descubrir%20cu%C3%A1l%20es%20tu%20perfil%20de%20usuario%20de%20IA%3A%20https%3A%2F%2Fiatest.patriciaemiguel.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 11.5A8.5 8.5 0 0 1 7.4 19l-3.4 1 1.1-3.2A8.5 8.5 0 1 1 20 11.5Z"></path>
            <path d="M9.5 9.5c.3-.7.6-.7.9-.7h.5c.2 0 .4 0 .5.4l.7 1.7c.1.2.1.4 0 .6l-.3.5c-.1.2-.2.3 0 .5.3.6 1 1.5 2.1 2 .2.1.4.1.5 0l.5-.6c.2-.2.4-.2.6-.1l1.6.8c.2.1.3.2.3.5v.5c0 .3-.1.6-.7.8-.6.2-1.9.2-3.5-.6-1.8-.9-3.2-2.7-3.8-4-.6-1.2-.3-2.3-.1-2.7Z"></path>
          </svg>
          WhatsApp
        </a>
        <a
          class="button-ghost share-button share-button--facebook"
          href="https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fiatest.patriciaemiguel.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.428c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
          </svg>
          Facebook
        </a>
        <a
          class="button-ghost share-button"
          href="mailto:?subject=%C2%BFCu%C3%A1l%20es%20tu%20perfil%20de%20usuario%20de%20IA%3F&body=Te%20comparto%20este%20test%20gratuito%20para%20descubrir%20c%C3%B3mo%20us%C3%A1s%20la%20IA%20y%20cu%C3%A1l%20es%20tu%20mayor%20riesgo%3A%20https%3A%2F%2Fiatest.patriciaemiguel.com"
        >
          <i data-lucide="mail"></i>
          E-mail
        </a>
        <button class="button-ghost share-button" type="button" id="copySiteLink">
          <i data-lucide="copy"></i>
          Copiar enlace
        </button>
      </div>
    </div>
  `;

  document.querySelector("#downloadPdf")?.addEventListener("click", () => {
    downloadPdf(record, profile, appConfig);
  });

  document
  .querySelector("#copySiteLink")
  ?.addEventListener("click", async () => {
    const button = document.querySelector("#copySiteLink");

    try {
      await navigator.clipboard.writeText(
        "https://iatest.patriciaemiguel.com"
      );

      button.innerHTML = `
        <i data-lucide="check"></i>
        <span>¡Enlace copiado!</span>
      `;

      lucide.createIcons();

      setTimeout(() => {
        button.innerHTML = `
          <i data-lucide="copy"></i>
          <span>Copiar enlace</span>
        `;
        lucide.createIcons();
      }, 2500);

    } catch {
      alert("No fue posible copiar el enlace.");
    }
  });
  
  document
    .querySelector("#copyPermanentLink")
    ?.addEventListener("click", async () => {
      const button = document.querySelector("#copyPermanentLink");

      try {
        await navigator.clipboard.writeText(window.location.href);
        button.innerHTML = `
        <i data-lucide="check"></i>
        <span>¡Enlace copiado!</span>
      `;
        lucide.createIcons();
        setTimeout(() => {
          button.innerHTML = `
          <i data-lucide="link"></i>
          <span>Copiar enlace permanente</span>
        `;
          lucide.createIcons();
        }, 2500);
      } catch {
        alert("No fue posible copiar el enlace.");
      }
    });

  lucide.createIcons();
}

function downloadPdf(record, profile, appConfig) {
  if (!window.jspdf?.jsPDF) {
    renderErrorState(
      "La librería de PDF todavía no está disponible. Intenta nuevamente en unos segundos.",
    );
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
  documentPdf.text(
    "Test de perfil de usuario de IA · Resultado",
    marginX,
    cursorY,
  );
  cursorY += 28;

  documentPdf.setFont("helvetica", "normal");
  documentPdf.setFontSize(11);
  const metaLines = [
    `Nombre: ${record.name}`,
    `Email: ${record.email}`,
    `Fecha: ${formatDate(record.timestamp).replace(/ a las.*/, "")}`,
  ];
  metaLines.forEach((line) => {
    documentPdf.text(line, marginX, cursorY);
    cursorY += 18;
  });

  cursorY += 14;

  documentPdf.setFont("helvetica", "bold");
  documentPdf.setFontSize(18);
  documentPdf.text("Tu perfil de usuario de IA es:", marginX, cursorY);

  cursorY += 26;

  documentPdf.setFont("helvetica", "bold");
  documentPdf.setFontSize(24);
  documentPdf.text(profile.label, marginX, cursorY);

  cursorY += 26;

  cursorY += 14;
  cursorY = writeSection(
    documentPdf,
    "Qué caracteriza a este perfil",
    profile.description,
    cursorY,
    marginX,
    usableWidth,
    pageHeight,
  );
  cursorY = writeSection(
    documentPdf,
    "Si este perfil te representa, probablemente alguna vez pensaste",
    profile.characteristicStatement,
    cursorY,
    marginX,
    usableWidth,
    pageHeight,
  );
  cursorY = writeListSection(
    documentPdf,
    "Lo que mejor haces",
    profile.strengths,
    cursorY,
    marginX,
    usableWidth,
    pageHeight,
  );
  cursorY = writeSection(
    documentPdf,
    "Lo que podría frenarte",
    profile.primaryRisk,
    cursorY,
    marginX,
    usableWidth,
    pageHeight,
  );
  cursorY = writeSection(
    documentPdf,
    "Lo que posiblemente todavía no estés aprovechando",
    profile.underutilizedOpportunities,
    cursorY,
    marginX,
    usableWidth,
    pageHeight,
  );
  cursorY = writeSection(
    documentPdf,
    "Qué te conviene aprender ahora",
    profile.nextLearningStep,
    cursorY,
    marginX,
    usableWidth,
    pageHeight,
  );

  const pageCount = documentPdf.getNumberOfPages();
  const footerText = `Informe generado para ${record.name} • ${record.email}`;

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    documentPdf.setPage(pageNumber);
    documentPdf.setFontSize(9);
    documentPdf.setTextColor(110, 118, 125);
    documentPdf.text(footerText, marginX, pageHeight - 24);
  }

  const filename = `Resultado-${sanitizeFileSegment(record.name)}.pdf`;
  documentPdf.save(filename);
}

function writeSection(
  pdf,
  title,
  body,
  cursorY,
  marginX,
  usableWidth,
  pageHeight,
) {
  if (
    title === "Si este perfil te representa, probablemente alguna vez pensaste"
  ) {
    body = `“${body}”`;
  }

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

function writeListSection(
  pdf,
  title,
  items,
  cursorY,
  marginX,
  usableWidth,
  pageHeight,
) {
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
