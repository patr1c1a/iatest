import { submitAssessment } from "./api.js";
import { escapeHtml, inferCountry, loadJson, shuffle } from "./utils.js";

const appRoot = document.querySelector("#app");
const progressFill = document.querySelector("#progressFill");
const questionCounter = document.querySelector("#questionCounter");

const dataUrls = {
  app: "data/app.json",
  questions: "data/questions.json",
  profiles: "data/profiles.json",
  tieBreakers: "data/tieBreakers.json",
};

const runtime = {
  appConfig: null,
  questions: [],
  profiles: {},
  tieBreakers: {},
  state: null,
  isSubmitting: false,
};

const TIE_BREAKER_QUESTION = "q11";

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  renderLoadingState("Preparando tu experiencia...");

  try {
    const [appConfig, questionsData, profilesData, tieBreakersData] =
      await Promise.all([
        loadJson(dataUrls.app),
        loadJson(dataUrls.questions),
        loadJson(dataUrls.profiles),
        loadJson(dataUrls.tieBreakers),
      ]);

    runtime.appConfig = appConfig;
    runtime.questions = questionsData.questions;
    runtime.profiles = profilesData.profiles;
    runtime.tieBreakers = tieBreakersData.tieBreakers;

    const params = new URLSearchParams(window.location.search);
    if (params.get("restart") === "1") {
      window.localStorage.removeItem(runtime.appConfig.storage.progressKey);
      window.history.replaceState({}, "", "index.html");
    }

    const showHome = params.get("home") === "1";

    runtime.state = restoreOrCreateState();

    if (showHome) {
      runtime.state.stage = "intro";
      persistState();

      window.history.replaceState({}, "", "index.html");
    }

    bindGlobalEvents();
    navigateToStage();
  } catch (error) {
    renderFatalError(
      "No fue posible cargar el test en este momento. Recarga la página para volver a intentarlo.",
    );
  }
}

function restoreOrCreateState() {
  const storageKey = runtime.appConfig.storage.progressKey;
  const storedValue = window.localStorage.getItem(storageKey);

  if (!storedValue) {
    return createFreshState();
  }

  try {
    const parsedState = JSON.parse(storedValue);
    const questionIds = runtime.questions.map((question) => question.id);
    const isCompatible =
      parsedState?.version === runtime.appConfig.storage.version &&
      Array.isArray(parsedState.questionOrder) &&
      questionIds.every((questionId) => {
        const storedOptionOrder = parsedState.optionOrder?.[questionId];
        const currentProfiles = runtime.questions
          .find((question) => question.id === questionId)
          ?.options.map((option) => option.profile);

        return (
          Array.isArray(storedOptionOrder) &&
          storedOptionOrder.length === currentProfiles?.length &&
          currentProfiles.every((profileKey) =>
            storedOptionOrder.includes(profileKey),
          )
        );
      });

    if (isCompatible) {
      return {
        ...createFreshState(),
        ...parsedState,
      };
    }
  } catch {
    window.localStorage.removeItem(storageKey);
  }

  return createFreshState();
}

function createFreshState() {
  const optionOrder = Object.fromEntries(
    runtime.questions.map((question) => [
      question.id,
      shuffle(question.options.map((option) => option.profile)),
    ]),
  );

  return {
    version: runtime.appConfig.storage.version,
    stage: "intro",
    questionOrder: runtime.questions.map((question) => question.id),
    optionOrder,
    currentQuestionIndex: 0,
    answers: {},
    finalProfile: "",
    tiedProfiles: [],
    tieBreakerChoice: "",
    lead: {
      name: "",
      email: "",
      city: "",
    },
  };
}

function persistState() {
  window.localStorage.setItem(
    runtime.appConfig.storage.progressKey,
    JSON.stringify(runtime.state),
  );
}

function resetState() {
  runtime.state = createFreshState();
  persistState();
  navigateToStage();
}

function bindGlobalEvents() {
  appRoot.addEventListener("click", handleClick);
  document.querySelector(".site-header").addEventListener("click", handleClick);
  appRoot.addEventListener("click", handleOptionClick);
  appRoot.addEventListener("change", handleChange);
  appRoot.addEventListener("input", handleInput);
  appRoot.addEventListener("submit", handleSubmit);
}

function handleClick(event) {
  const actionTarget = event.target.closest("[data-action]");

  if (!actionTarget) {
    return;
  }

  const { action } = actionTarget.dataset;

  switch (action) {
    case "start-test":
      runtime.state.stage = "question";
      if (Object.keys(runtime.state.answers).length === 0) {
        runtime.state.currentQuestionIndex = 0;
      }
      persistState();
      navigateToStage();
      break;
    case "restart-test":
      resetState();
      break;
    case "next-question":
      goToNextStep();
      break;
    case "previous-step":
      goToPreviousStep();
      break;
    default:
      break;
  }
}

function handleOptionClick(event) {
  const radioInput = event.target.closest("input[type='radio']");

  if (!radioInput) {
    return;
  }

  if (radioInput.name.startsWith("question-")) {
    if (
      runtime.state.answers[radioInput.name.replace("question-", "")] ===
      radioInput.value
    ) {
      window.setTimeout(goToNextStep, 100);
    }
  }

  if (
    radioInput.name === "tie-breaker" &&
    runtime.state.tieBreakerChoice === radioInput.value
  ) {
    window.setTimeout(goToNextStep, 100);
  }
}

function handleChange(event) {
  const radioInput = event.target.closest("input[type='radio']");

  if (!radioInput) {
    return;
  }

  if (radioInput.name.startsWith("question-")) {
    const questionId = radioInput.name.replace("question-", "");
    runtime.state.answers[questionId] = radioInput.value;
    runtime.state.finalProfile = "";
    runtime.state.tiedProfiles = [];
    runtime.state.tieBreakerChoice = "";
    persistState();

    setTimeout(() => {
      goToNextStep();
    }, 180);

    return;
  }

  if (radioInput.name === "tie-breaker") {
    runtime.state.tieBreakerChoice = radioInput.value;
    runtime.state.finalProfile = radioInput.value;
    persistState();

    setTimeout(() => {
      goToNextStep();
    }, 180);
  }
}

function handleInput(event) {
  const field = event.target;

  if (!(field instanceof HTMLInputElement)) {
    return;
  }

  if (["name", "email", "city"].includes(field.name)) {
    runtime.state.lead[field.name] = field.value;
    persistState();
  }
}

async function handleSubmit(event) {
  const form = event.target.closest("#leadForm");

  if (!form) {
    return;
  }

  event.preventDefault();

  if (runtime.isSubmitting) {
    return;
  }

  const answers = {
    ...runtime.state.answers,
  };

  if (runtime.state.tieBreakerChoice) {
    answers[TIE_BREAKER_QUESTION] = runtime.state.tieBreakerChoice;
  }
  const formData = new FormData(form);

  const payload = {
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    city: String(formData.get("city") || "").trim(),
    answers,
    testVersion: runtime.appConfig.storage.version,
  };

  runtime.state.lead = {
    name: payload.name,
    email: payload.email,
    city: payload.city,
  };
  persistState();

  const validationMessage = validateLeadPayload(payload);

  if (validationMessage) {
    renderCurrentStage(validationMessage, "error");
    return;
  }

  runtime.isSubmitting = true;
  renderCurrentStage("", "pending");

  try {
    const response = await submitAssessment(runtime.appConfig, payload);

    window.localStorage.removeItem(runtime.appConfig.storage.progressKey);

    window.location.assign("submission-success.html");
  } catch (error) {
    runtime.isSubmitting = false;
    renderCurrentStage(
      error.message ||
        "No fue posible guardar tus datos. Revisalos para volver a intentarlo.",
      "error",
    );
  }
}

function validateLeadPayload(payload) {
  if (!payload.name) {
    return "Ingresa tu nombre para continuar.";
  }

  if (!payload.email) {
    return "Ingresa tu email para poder enviarte el resultado.";
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(payload.email)) {
    return "Ingresa un email válido.";
  }

  for (let i = 1; i <= runtime.questions.length; i++) {
    if (!payload.answers[`q${i}`]) {
      return "Completa todas las preguntas antes de enviar tus datos.";
    }
  }

  return "";
}

function goToNextStep() {
  if (runtime.state.stage === "question") {
    const currentQuestion =
      runtime.questions[runtime.state.currentQuestionIndex];

    if (!runtime.state.answers[currentQuestion.id]) {
      renderCurrentStage("Selecciona una opción antes de avanzar.", "error");
      return;
    }

    if (runtime.state.currentQuestionIndex < runtime.questions.length - 1) {
      runtime.state.currentQuestionIndex += 1;
      persistState();
      navigateToStage();
      return;
    }

    resolveFinalStage();
  }

  if (runtime.state.stage === "tie" && runtime.state.tieBreakerChoice) {
    runtime.state.stage = "lead";
    persistState();
    renderCurrentStage();
  }
}

function goToPreviousStep() {
  if (runtime.state.stage === "question") {
    if (runtime.state.currentQuestionIndex > 0) {
      runtime.state.currentQuestionIndex -= 1;
      persistState();
      navigateToStage();
      return;
    }

    runtime.state.stage = "intro";
    persistState();
    navigateToStage();
    return;
  }

  if (runtime.state.stage === "tie") {
    runtime.state.stage = "question";
    runtime.state.currentQuestionIndex = runtime.questions.length - 1;
    runtime.state.tieBreakerChoice = "";
    runtime.state.finalProfile = "";
    persistState();
    navigateToStage();
    return;
  }

  if (runtime.state.stage === "lead") {
    if (runtime.state.tiedProfiles.length > 0) {
      runtime.state.stage = "tie";
    } else {
      runtime.state.stage = "question";
      runtime.state.currentQuestionIndex = runtime.questions.length - 1;
    }

    persistState();
    navigateToStage();
  }
}

function resolveFinalStage() {
  const scores = Object.fromEntries(
    Object.keys(runtime.profiles).map((profileKey) => [profileKey, 0]),
  );

  Object.values(runtime.state.answers).forEach((profileKey) => {
    scores[profileKey] += 1;
  });

  const highestScore = Math.max(...Object.values(scores));
  const topProfiles = Object.entries(scores)
    .filter(([, score]) => score === highestScore)
    .map(([profileKey]) => profileKey);

  if (topProfiles.length === 1) {
    runtime.state.finalProfile = topProfiles[0];
    runtime.state.stage = "lead";
    runtime.state.tiedProfiles = [];
    persistState();
    navigateToStage();
    return;
  }

  runtime.state.tiedProfiles = [...topProfiles].sort(
    (left, right) =>
      runtime.appConfig.resultRules.fallbackPriority.indexOf(left) -
      runtime.appConfig.resultRules.fallbackPriority.indexOf(right),
  );
  runtime.state.stage = "tie";
  runtime.state.tieBreakerChoice = "";
  runtime.state.finalProfile = "";
  persistState();
  navigateToStage();
}

function renderCurrentStage(feedbackMessage = "", feedbackType = "") {
  updateProgress();

  switch (runtime.state.stage) {
    case "intro":
      renderIntroScreen();
      break;
    case "question":
      renderQuestionScreen(feedbackMessage, feedbackType);
      break;
    case "tie":
      renderTieBreakerScreen(feedbackMessage, feedbackType);
      break;
    case "lead":
      renderLeadScreen(feedbackMessage, feedbackType);
      break;
    default:
      renderFatalError("No fue posible recuperar el estado del test.");
      break;
  }

  appRoot.setAttribute("aria-busy", "false");
}

function navigateToStage() {
  renderCurrentStage();

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

function updateProgress() {
  const isIntro = runtime.state.stage === "intro";

  document.querySelector(".site-header").style.display = isIntro ? "none" : "";

  if (isIntro) {
    return;
  }

  let current = runtime.state.currentQuestionIndex + 1;

  if (runtime.state.stage === "tie") {
    current = runtime.questions.length;
  }

  if (runtime.state.stage === "lead") {
    current = runtime.questions.length;
  }

  questionCounter.textContent = `${Math.min(current, runtime.questions.length)}/${runtime.questions.length}`;

  progressFill.style.width = `${(current / runtime.questions.length) * 100}%`;
}

function renderIntroScreen() {
  const hasProgress = Object.keys(runtime.state.answers).length > 0;

  appRoot.innerHTML = `
    <section class="intro-screen">

      <p class="eyebrow">
        Test gratuito
      </p>

      <h1 class="intro-title">
        ¿Cómo te relacionas con la IA?
      </h1>

      <div class="intro-description">

        <div class="intro-description__text">
          <p>
            Una evaluación breve para identificar tu perfil como usuario de inteligencia
            artificial y recibir tu resultado personalizado.
          </p>
        </div>

        <div class="intro-description__image">
          <img
            src="assets/images/laptop-brain.png"
            alt=""
            class="intro-illustration"
            aria-hidden="true"
          />
        </div>

      </div>

      <div class="intro-divider"></div>

      <div class="button-row intro-actions">
        <button
          type="button"
          class="button"
          data-action="start-test">
          ${hasProgress ? "Continuar" : "Comenzar"}
        </button>

        ${
          hasProgress
            ? `
            <button
              type="button"
              class="button-ghost"
              data-action="restart-test">
              Empezar de nuevo
            </button>
          `
            : ""
        }
      </div>

    </section>
  `;
}

function renderQuestionScreen(feedbackMessage = "", feedbackType = "") {
  const question = runtime.questions[runtime.state.currentQuestionIndex];

  if (!question) {
    resetState();
    return;
  }

  const selectedProfile = runtime.state.answers[question.id] || "";
  const orderedProfiles = runtime.state.optionOrder[question.id];
  const orderedOptions = orderedProfiles
    ?.map((profileKey) =>
      question.options.find((option) => option.profile === profileKey),
    )
    .filter(Boolean);
  const optionsToRender =
    orderedOptions?.length === question.options.length
      ? orderedOptions
      : question.options;
  const optionsMarkup = optionsToRender
    .map((option, index) => {
      const isSelected = option.profile === selectedProfile;

      return `
        <label class="option-card ${isSelected ? "is-selected" : ""}">
          <input
            type="radio"
            name="question-${escapeHtml(question.id)}"
            value="${escapeHtml(option.profile)}"
            ${isSelected ? "checked" : ""}
          />
          <span class="option-card-body">
          <span class="option-arrow">▶</span>${escapeHtml(option.text)}</span>
        </label>
      `;
    })
    .join("");

  appRoot.innerHTML = `
    <section class="screen">
      <div class="screen-header">
        <div class="question-count">Pregunta ${runtime.state.currentQuestionIndex + 1}</div>
        <h2>${escapeHtml(question.text)}</h2>
      </div>

      ${renderFeedback(feedbackMessage, feedbackType)}

      <fieldset class="option-list">
        <legend class="sr-only">${escapeHtml(question.text)}</legend>
        ${optionsMarkup}
      </fieldset>

    </section>
  `;
}

function renderTieBreakerScreen(feedbackMessage = "", feedbackType = "") {
  const tieData = runtime.tieBreakers.question;

  if (!tieData || !runtime.state.tiedProfiles.length) {
    renderFatalError(
      "No se encontró la configuración de la pregunta de desempate.",
    );
    return;
  }

  const optionsMarkup = runtime.state.tiedProfiles
    .map((profileKey, index) => {
      const isSelected = runtime.state.tieBreakerChoice === profileKey;
      const profileInfo = runtime.profiles[profileKey];

      return `
        <label class="option-card ${isSelected ? "is-selected" : ""}">
          <input
            type="radio"
            name="tie-breaker"
            value="${escapeHtml(profileKey)}"
            ${isSelected ? "checked" : ""}
          />
          <span class="option-card-body">
          <span class="option-arrow">▶</span>${escapeHtml(tieData.options[profileKey] || "")}</span>
        </label>
      `;
    })
    .join("");

  appRoot.innerHTML = `
    <section class="screen">
      <div class="screen-header">
        <p class="screen-kicker">Pregunta final</p>
        <h2>${escapeHtml(tieData.prompt)}</h2>
        <p class="helper-text">
          Tus respuestas muestran características de más de un perfil. Esta pregunta adicional ayuda a identificar cuál te representa mejor.
        </p>
      </div>

      ${renderFeedback(feedbackMessage, feedbackType)}

      <fieldset class="option-list">
        <legend class="sr-only">Opciones de desempate</legend>
        ${optionsMarkup}
      </fieldset>

    </section>
  `;
}

function renderLeadScreen(feedbackMessage = "", feedbackType = "") {
  const submittingMessage = runtime.isSubmitting
    ? "Se está enviando tu resultado personalizado a tu correo electrónico."
    : "";

  appRoot.innerHTML = `
    <section class="screen">
      <div class="screen-header">
        <p class="screen-kicker">Recibir tu resultado</p>
        <h2>Ingresa tus datos para recibir tu informe completo</h2>
      </div>

      ${renderFeedback(feedbackMessage, feedbackType)}
      ${submittingMessage ? renderFeedback(submittingMessage, "success") : ""}

      <form id="leadForm" class="screen" novalidate>
        <div class="grid-two">
          <div class="field-group">
            <label class="field-label" for="name">Nombre y apellido <span class="field-help">(requerido)</span></label>
            <input
              class="field-input"
              id="name"
              name="name"
              type="text"
              autocomplete="name"
              value="${escapeHtml(runtime.state.lead.name)}"
              required
            />
          </div>

          <div class="field-group">
            <label class="field-label" for="email">Email <span class="field-help">(requerido)</span></label>
            <input
              class="field-input"
              id="email"
              name="email"
              type="email"
              autocomplete="email"
              value="${escapeHtml(runtime.state.lead.email)}"
              required
            />
          </div>
        </div>

        <div class="grid-two">

          <div class="field-group">
            <label class="field-label" for="city">Ciudad <span class="field-help">(opcional)</span></label>
            <input
              class="field-input"
              id="city"
              name="city"
              type="text"
              autocomplete="address-level2"
              value="${escapeHtml(runtime.state.lead.city)}"
            />
          </div>
          <div></div>
        </div>

        <div class="button-row">
          <button type="submit" class="button" ${runtime.isSubmitting ? "disabled" : ""}>
            ${runtime.isSubmitting ? "Enviando..." : "Recibir resultado por email"}
          </button>
        </div>
      </form>
    </section>
  `;
}

function renderFeedback(message, type) {
  if (!message) {
    return "";
  }

  const className =
    type === "success" || type === "pending"
      ? "feedback-success"
      : "feedback-error";

  return `<div class="feedback ${className}" role="status">${escapeHtml(message)}</div>`;
}

function renderLoadingState(message) {
  appRoot.innerHTML = `
    <section class="loading-state">
      <div>
        <div class="spinner" aria-hidden="true"></div>
        <p>${escapeHtml(message)}</p>
      </div>
    </section>
  `;
}

function renderFatalError(message) {
  progressLabel.textContent = "Error de carga";
  progressDetail.textContent = "No fue posible iniciar el test.";
  progressFill.style.width = "0%";

  appRoot.innerHTML = `
    <section class="empty-state">
      <div>
        <h2>No fue posible continuar</h2>
        <p class="section-copy">${escapeHtml(message)}</p>
        <div class="button-row">
          <a class="button" href="${window.location.pathname}">Recargar página</a>
        </div>
      </div>
    </section>
  `;
}
