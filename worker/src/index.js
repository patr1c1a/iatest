import emailTemplate from "../../data/email.json";
import profilesCatalog from "../../data/profiles.json";

const QUESTION_COUNT = 10;
const TIE_BREAKER_QUESTION = "q11";
const PROFILE_KEYS = Object.keys(profilesCatalog.profiles);
const SHEET_HEADERS = [
  "timestamp",
  "token",
  "testVersion",
  "name",
  "email",
  "city",
  "country",
  "result",
  "q1",
  "q2",
  "q3",
  "q4",
  "q5",
  "q6",
  "q7",
  "q8",
  "q9",
  "q10",
  "q11",
];

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url);

    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }), request, env);
    }

    try {
      if (request.method === "POST" && requestUrl.pathname === "/api/submissions") {
        return withCors(await handleSubmission(request, env), request, env);
      }

      if (request.method === "GET" && requestUrl.pathname.startsWith("/api/results/")) {
        const token = decodeURIComponent(requestUrl.pathname.split("/").pop() || "");
        return withCors(await handleResultLookup(token, env), request, env);
      }

      if (request.method === "GET" && requestUrl.pathname === "/api/results") {
        const token = requestUrl.searchParams.get("t") || requestUrl.searchParams.get("token") || "";
        return withCors(await handleResultLookup(token, env), request, env);
      }

      return withCors(
        jsonResponse({ error: "Ruta no encontrada." }, 404),
        request,
        env,
      );
    } catch (error) {
      console.error("worker_error", error);

      return withCors(
        jsonResponse(
          { error: "No pudimos completar la operación en este momento." },
          500,
        ),
        request,
        env,
      );
    }
  },
};

async function handleSubmission(request, env) {
  const payload = await request.json();
  const validationError = validatePayload(payload);

  if (validationError) {
    return jsonResponse({ error: validationError }, 400);
  }

  await ensureSheetHeaders(env);

  const token = crypto.randomUUID().replaceAll("-", "");
  const country = sanitizeText(payload.country) || request.cf?.country || "";
  let finalProfile;
  try {
    finalProfile = resolveFinalProfile(payload.answers);
  } catch (error) {
    return jsonResponse(
      { error: error.message },
      400,
    );
  }
  const record = {
    timestamp: new Date().toISOString(),
    token,
    testVersion: payload.testVersion,
    name: sanitizeText(payload.name),
    email: sanitizeText(payload.email),
    city: sanitizeText(payload.city),
    country,
    result: finalProfile,
    answers: payload.answers,
  };

  await appendSheetRow(env, record);

  const resultUrl = buildResultUrl(env.SITE_DOMAIN, token);
  let emailWarning = "";

  try {
    await sendResultEmail(env, record, resultUrl);
  } catch (error) {
    console.error("email_error", error);
    emailWarning =
      "No pudimos enviar el email automáticamente, pero tu resultado quedó guardado.";
  }

  return jsonResponse(
    {
      token,
      resultUrl,
      emailWarning,
    },
    201,
  );
}

async function handleResultLookup(token, env) {
  if (!token) {
    return jsonResponse({ error: "Debes indicar un token válido." }, 400);
  }

  await ensureSheetHeaders(env);

  const records = await readSheetRecords(env);
  const matchedRecord = records.find((record) => record.token === token);

  if (!matchedRecord) {
    return jsonResponse({ error: "No encontramos un resultado asociado a ese enlace." }, 404);
  }

  return jsonResponse({ record: matchedRecord });
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "El cuerpo de la solicitud no es válido.";
  }

  const name = sanitizeText(payload.name);
  const email = sanitizeText(payload.email);

  if (!name) {
    return "El nombre es obligatorio.";
  }

  if (!email) {
    return "El email es obligatorio.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "El email no tiene un formato válido.";
  }

  if (!payload.answers || typeof payload.answers !== "object") {
    return "Las respuestas del test son obligatorias.";
  }

  for (let i = 1; i <= QUESTION_COUNT; i++) {
    if (!PROFILE_KEYS.includes(payload.answers[`q${i}`])) {
      return `La respuesta a q${i} no es válida.`;
    }
  }

  if (
    payload.answers[TIE_BREAKER_QUESTION] &&
    !PROFILE_KEYS.includes(payload.answers[TIE_BREAKER_QUESTION])
  ) {
    return "La respuesta a q11 no es válida.";
  }

  return "";
}

function sanitizeText(value) {
  return String(value ?? "").trim();
}

function resolveFinalProfile(answers) {
  const scores = Object.fromEntries(
    PROFILE_KEYS.map((profile) => [profile, 0]),
  );

  for (let i = 1; i <= QUESTION_COUNT; i++) {
    scores[answers[`q${i}`]] += 1;
  }

  const highestScore = Math.max(...Object.values(scores));

  const tiedProfiles = Object.entries(scores)
    .filter(([, score]) => score === highestScore)
    .map(([profile]) => profile);

  if (tiedProfiles.length === 1) {
    return tiedProfiles[0];
  }

  if (!answers[TIE_BREAKER_QUESTION]) {
    throw new Error("Tie breaker answer is missing.");
  }

  if (!tiedProfiles.includes(answers[TIE_BREAKER_QUESTION])) {
    throw new Error("Tie breaker answer is not one of the tied profiles.");
  }

  return answers[TIE_BREAKER_QUESTION];
}

function buildResultUrl(siteDomain, token) {
  const sanitizedDomain = String(siteDomain || "").replace(/\/$/, "");
  return `${sanitizedDomain}/result.html?t=${encodeURIComponent(token)}`;
}

function withCors(response, request, env) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Allow-Origin", resolveCorsOrigin(request, env));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function resolveCorsOrigin(request, env) {
  const requestOrigin = request.headers.get("Origin");
  const allowedOrigins = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!allowedOrigins.length) {
    return "*";
  }

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return allowedOrigins[0];
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

async function ensureSheetHeaders(env) {
  const headerRange = buildSheetRange(env.GOOGLE_SHEET_NAME, "A1:S1");
  const currentHeaderRow = await sheetsRequest(
    env,
    `/values/${headerRange}`,
    { method: "GET" },
  );

  const currentHeaders = currentHeaderRow.values?.[0] || [];
  const headersMissing =
    currentHeaders.length !== SHEET_HEADERS.length ||
    SHEET_HEADERS.some((header, index) => currentHeaders[index] !== header);

  if (!headersMissing) {
    return;
  }

  await sheetsRequest(
    env,
    `/values/${headerRange}?valueInputOption=RAW`,
    {
      method: "PUT",
      body: JSON.stringify({
        values: [SHEET_HEADERS],
      }),
    },
  );
}

async function appendSheetRow(env, record) {
  const range = buildSheetRange(env.GOOGLE_SHEET_NAME, "A:S");
  const values = [
    record.timestamp,
    record.token,
    record.testVersion,
    record.name,
    record.email,
    record.city,
    record.country,
    record.result,
    record.answers.q1 || "",
    record.answers.q2 || "",
    record.answers.q3 || "",
    record.answers.q4 || "",
    record.answers.q5 || "",
    record.answers.q6 || "",
    record.answers.q7 || "",
    record.answers.q8 || "",
    record.answers.q9 || "",
    record.answers.q10 || "",
    record.answers.q11 || "",
  ];

  await sheetsRequest(
    env,
    `/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({ values: [values] }),
    },
  );
}

async function readSheetRecords(env) {
  const range = buildSheetRange(env.GOOGLE_SHEET_NAME, "A:S");
  const response = await sheetsRequest(env, `/values/${range}`, { method: "GET" });
  const rows = response.values || [];

  if (rows.length <= 1) {
    return [];
  }

  return rows.slice(1).map((row) => ({
    timestamp: row[0] || "",
    token: row[1] || "",
    testVersion: Number(row[2]) || 1,
    name: row[3] || "",
    email: row[4] || "",
    city: row[5] || "",
    country: row[6] || "",
    result: row[7] || "",
    answers: {
      q1: row[8] || "",
      q2: row[9] || "",
      q3: row[10] || "",
      q4: row[11] || "",
      q5: row[12] || "",
      q6: row[13] || "",
      q7: row[14] || "",
      q8: row[15] || "",
      q9: row[16] || "",
      q10: row[17] || "",
      q11: row[18] || "",
    },
  }));
}

function buildSheetRange(sheetName, cells) {
  return encodeURIComponent(`${sheetName}!${cells}`);
}

async function sheetsRequest(env, path, options) {
  const accessToken = await getGoogleAccessToken(env);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=utf-8",
        ...(options.headers || {}),
      },
    },
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error?.message || "No pudimos comunicarnos con Google Sheets.");
  }

  return payload;
}

async function sendResultEmail(env, record, resultUrl) {
  const profileLabel = profilesCatalog.profiles[record.result]?.label || record.result;
  const substitutions = {
    name: record.name,
    profile: profileLabel,
    resultUrl,
  };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      from: `${emailTemplate.fromName} <${emailTemplate.fromEmail}>`,
      to: [record.email],
      subject: interpolateTemplate(emailTemplate.subject, substitutions),
      html: interpolateTemplate(emailTemplate.htmlBody, substitutions),
      text: interpolateTemplate(emailTemplate.textBody, substitutions),
    }),
  });

  if (!response.ok) {
    const errorPayload = await response.text();
    throw new Error(errorPayload || "No pudimos enviar el email con Resend.");
  }
}

function interpolateTemplate(template, substitutions) {
  return Object.entries(substitutions).reduce(
    (compiledTemplate, [key, value]) =>
      compiledTemplate.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

async function getGoogleAccessToken(env) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  const claim = {
    iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: nowInSeconds + 3600,
    iat: nowInSeconds,
  };

  const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claim))}`;
  const signature = await signJwt(unsignedToken, env.GOOGLE_PRIVATE_KEY);
  const jwt = `${unsignedToken}.${signature}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenPayload = await tokenResponse.json();

  if (!tokenResponse.ok) {
    throw new Error(
      tokenPayload.error_description ||
        tokenPayload.error ||
        "No pudimos autenticar con Google.",
    );
  }

  return tokenPayload.access_token;
}

async function signJwt(content, privateKeyPem) {
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(content),
  );

  return arrayBufferToBase64Url(signatureBuffer);
}

function pemToArrayBuffer(pem) {
  const normalizedPem = String(pem)
    .replaceAll("\\n", "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binaryValue = atob(normalizedPem);
  const bytes = new Uint8Array(binaryValue.length);

  for (let index = 0; index < binaryValue.length; index += 1) {
    bytes[index] = binaryValue.charCodeAt(index);
  }

  return bytes.buffer;
}

function base64UrlEncode(value) {
  const bytes = new TextEncoder().encode(value);
  return arrayBufferToBase64Url(bytes.buffer);
}

function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
