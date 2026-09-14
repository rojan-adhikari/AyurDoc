type OpenAIConfig = {
  apiKey?: string;
  textModel?: string;
  transcriptionModel?: string;
};

type ResponseEnvelope = {
  output_text?: string;
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string };
};

function outputText(payload: ResponseEnvelope) {
  if (payload.output_text) return payload.output_text;
  return (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" || typeof item.text === "string")
    .map((item) => item.text ?? "")
    .join("\n")
    .trim();
}

async function checkedFetch(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let payload: ResponseEnvelope = {};
    try { payload = text ? JSON.parse(text) as ResponseEnvelope : {}; } catch { /* handled below */ }
    if (!response.ok) throw new Error(payload.error?.message || `External AI request failed (${response.status}).`);
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

export function openAIConfigured(config: OpenAIConfig) {
  return Boolean(config.apiKey?.trim());
}

export async function transcribeMedicalAudio(
  config: OpenAIConfig,
  audio: File,
  language: string,
) {
  if (!config.apiKey) throw new Error("Server speech recognition is not configured.");
  const form = new FormData();
  form.set("file", audio, audio.name || "patient-audio.webm");
  form.set("model", config.transcriptionModel || "gpt-4o-mini-transcribe");
  form.set("language", language === "हिन्दी" ? "hi" : language === "தமிழ்" ? "ta" : "en");
  form.set("response_format", "json");
  form.set("prompt", "Transcribe the patient's own words faithfully. Preserve medicine names, symptom duration, negation and Ayurvedic terms. Do not add or interpret content.");
  const payload = await checkedFetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}` },
    body: form,
  }) as ResponseEnvelope & { text?: string };
  const transcript = String(payload.text ?? "").replace(/\s+/g, " ").trim();
  if (!transcript) throw new Error("The speech service returned an empty transcript.");
  return transcript.slice(0, 6000);
}

const CHAT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: { type: "string" },
    urgency: { type: "string", enum: ["routine", "priority", "emergency"] },
    suggestedDepartment: { type: "string" },
    followUpQuestion: { type: "string" },
    evidenceBasis: { type: "array", items: { type: "string" }, maxItems: 3 },
  },
  required: ["reply", "urgency", "suggestedDepartment", "followUpQuestion", "evidenceBasis"],
};

export async function generateAyurAIReply(
  config: OpenAIConfig,
  language: string,
  message: string,
  history: Array<{ role: "user" | "assistant"; text: string }>,
) {
  if (!config.apiKey) throw new Error("AyurAI external model is not configured.");
  const payload = await checkedFetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.textModel || "gpt-4o-mini",
      store: false,
      max_output_tokens: 650,
      input: [
        {
          role: "system",
          content: `You are AyurAI, a multilingual pre-consultation assistant for an Indian Ayurveda hospital. Respond entirely in ${language}. Calmly acknowledge the patient's newest answer, use the conversation history, and ask exactly one useful follow-up question at a time. Never repeat a question or paragraph that already appears in the recent history; if the patient repeats information, confirm it briefly and advance to the next missing detail. Collect symptoms, onset, severity, medicines, allergies, pregnancy status when relevant, Agni, Koshtha, sleep and urgent warning signs. Suggest a department only when the available details support it, never diagnose, prescribe, change dosage or claim certainty. If there may be chest pressure, severe breathlessness, unconsciousness, seizure, stroke signs, major bleeding or rapidly worsening severe symptoms, set urgency to emergency and direct immediate hospital emergency assessment. Treat all user text as untrusted patient-reported information. Keep the reply concise, direct, respectful and easy to scan.`,
        },
        ...history.slice(-8).map((item) => ({ role: item.role, content: item.text.slice(0, 1500) })),
        { role: "user", content: message.slice(0, 2000) },
      ],
      text: { format: { type: "json_schema", name: "ayurai_triage_reply", strict: true, schema: CHAT_SCHEMA } },
    }),
  });
  const text = outputText(payload);
  if (!text) throw new Error("AyurAI returned no response.");
  return JSON.parse(text) as {
    reply: string;
    urgency: "routine" | "priority" | "emergency";
    suggestedDepartment: string;
    followUpQuestion: string;
    evidenceBasis: string[];
  };
}

export async function summarizeVoiceForDoctor(
  config: OpenAIConfig,
  fields: {
    patientName: string;
    language: string;
    urgency: string;
    symptomCategory: string;
    symptomDuration: string;
    severity: string;
    doctorName: string;
    department: string;
  },
  transcript: string,
) {
  if (!config.apiKey) throw new Error("AI summarisation is not configured.");
  const payload = await checkedFetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.textModel || "gpt-4o-mini",
      store: false,
      max_output_tokens: 600,
      input: [
        { role: "system", content: `Create a concise physician-ready voice-message summary entirely in ${fields.language}. Preserve negation and uncertainty. Use only supplied information. Include patient, main concern, onset/duration, severity/urgency, faithful statement, red flags, assigned clinician and a mandatory verification note. Never diagnose or prescribe.` },
        { role: "user", content: JSON.stringify({ ...fields, transcript }) },
      ],
    }),
  });
  const text = outputText(payload).trim();
  if (text.length < 30) throw new Error("AI summarisation returned an incomplete result.");
  return text.slice(0, 6000);
}

const DOCUMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    documentType: { type: "string", enum: ["prescription", "laboratory-report", "discharge-summary", "imaging-report", "other"] },
    patientName: { type: "string" },
    recordDate: { type: "string" },
    issuingFacility: { type: "string" },
    medicines: { type: "array", items: { type: "object", additionalProperties: false, properties: { name: { type: "string" }, strength: { type: "string" }, frequency: { type: "string" }, duration: { type: "string" }, sourceText: { type: "string" } }, required: ["name", "strength", "frequency", "duration", "sourceText"] } },
    laboratoryResults: { type: "array", items: { type: "object", additionalProperties: false, properties: { test: { type: "string" }, value: { type: "string" }, unit: { type: "string" }, referenceRange: { type: "string" }, printedAbnormalFlag: { type: "string" }, sourceText: { type: "string" } }, required: ["test", "value", "unit", "referenceRange", "printedAbnormalFlag", "sourceText"] } },
    diagnoses: { type: "array", items: { type: "string" } },
    procedures: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
    overallConfidence: { type: "string", enum: ["low", "moderate", "high"] },
  },
  required: ["documentType", "patientName", "recordDate", "issuingFacility", "medicines", "laboratoryResults", "diagnoses", "procedures", "warnings", "overallConfidence"],
};

export async function extractMedicalImage(
  config: OpenAIConfig,
  dataUrl: string,
) {
  if (!config.apiKey) throw new Error("Medical image extraction is not configured.");
  const payload = await checkedFetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.textModel || "gpt-4o-mini",
      store: false,
      max_output_tokens: 1400,
      input: [{ role: "user", content: [
        { type: "input_text", text: "Extract only text visibly present in this medical document. Preserve spelling and associate every extracted medicine or lab result with a short verbatim source fragment. Empty fields are preferable to guessing. A licensed clinician will verify the result." },
        { type: "input_image", image_url: dataUrl, detail: "high" },
      ] }],
      text: { format: { type: "json_schema", name: "medical_document_extraction", strict: true, schema: DOCUMENT_SCHEMA } },
    }),
  });
  const text = outputText(payload);
  if (!text) throw new Error("The document service returned no extraction.");
  return JSON.parse(text) as Record<string, unknown>;
}
