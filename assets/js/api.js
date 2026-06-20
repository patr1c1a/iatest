import { buildApiUrl } from "./utils.js";

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.error || "No se pudo completar la solicitud.");
  }

  return payload;
}

export function submitAssessment(appConfig, payload) {
  const url = buildApiUrl(
    appConfig.api.baseUrl,
    appConfig.api.submitPath,
  );

  return requestJson(url, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchResultByToken(appConfig, token) {
  const url = buildApiUrl(
    appConfig.api.baseUrl,
    appConfig.api.resultPath,
    { token },
  );

  return requestJson(url);
}
