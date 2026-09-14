import { env } from "cloudflare:workers";
import { getAppSession } from "../../../lib/session";
import { isValidPhoneNumber, normalizePhone } from "../../../lib/validation";
import { doctorForId, scopedDoctorId } from "../../../lib/doctor-directory";
import { createVoiceSummary } from "../../../lib/voice-summary";
import {
  openAIConfigured,
  summarizeVoiceForDoctor,
  transcribeMedicalAudio,
} from "../../../lib/openai-integration";
import {
  deleteD1File,
  getD1File,
  MAX_D1_FILE_BYTES,
  putD1File,
} from "../../../lib/d1-file-storage";

const AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/x-m4a",
  "audio/aac",
  "audio/3gpp",
  "audio/amr",
]);

type VoiceRow = {
  object_key: string;
  mime_type: string;
  patient_username: string;
  doctor_id: string;
};

type VoiceFields = {
  patientName: string;
  phone: string;
  department: string;
  doctorId: string;
  doctorName: string;
  language: string;
  urgency: string;
  symptomCategory: string;
  symptomDuration: string;
  severity: string;
  durationSeconds: number;
  transcript: string;
};

function readFields(form: FormData): VoiceFields {
  return {
    patientName: String(form.get("patientName") ?? "").trim(),
    phone: String(form.get("phone") ?? "").trim(),
    department: String(form.get("department") ?? "").trim(),
    doctorId: String(form.get("doctorId") ?? "").trim(),
    doctorName: String(form.get("doctorName") ?? "").trim(),
    language: String(form.get("language") ?? "English").trim(),
    urgency: String(form.get("urgency") ?? "Routine").trim(),
    symptomCategory: String(form.get("symptomCategory") ?? "").trim(),
    symptomDuration: String(form.get("symptomDuration") ?? "").trim(),
    severity: String(form.get("severity") ?? "").trim(),
    durationSeconds: Math.max(
      0,
      Math.round(Number(form.get("durationSeconds") ?? 0)),
    ),
    transcript: String(form.get("transcript") ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000),
  };
}

function validFields(fields: VoiceFields, requireTranscript = true) {
  return Boolean(
    fields.patientName &&
    fields.patientName.length <= 120 &&
    isValidPhoneNumber(fields.phone) &&
    fields.department &&
    fields.department.length <= 100 &&
    fields.doctorId &&
    fields.doctorName &&
    ["English", "हिन्दी", "தமிழ்"].includes(fields.language) &&
    ["Routine", "Urgent"].includes(fields.urgency) &&
    fields.symptomCategory &&
    fields.symptomDuration &&
    ["Mild", "Moderate", "Severe"].includes(fields.severity) &&
    (!requireTranscript || fields.transcript.length >= 2),
  );
}

async function validDoctorReferral(fields: VoiceFields) {
  const builtIn = doctorForId(fields.doctorId);
  if (builtIn)
    return builtIn.name === fields.doctorName && builtIn.department === fields.department;
  const managed = await env.DB.prepare(
    `SELECT name, department FROM doctor_directory_overrides
     WHERE doctor_id = ? AND visible = 1`,
  )
    .bind(fields.doctorId)
    .first<{ name: string; department: string }>();
  return managed?.name === fields.doctorName && managed.department === fields.department;
}

function extensionFor(mimeType: string) {
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("3gpp")) return "3gp";
  if (mimeType.includes("aac")) return "aac";
  if (mimeType.includes("amr")) return "amr";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

function validAudio(audio: FormDataEntryValue | null): audio is File {
  return (
    audio instanceof File &&
    audio.size >= 100 &&
    audio.size <= MAX_D1_FILE_BYTES &&
    AUDIO_TYPES.has(audio.type.split(";")[0].toLowerCase())
  );
}

function guidedTranscript(language: string, details: {
  name: string; age: string; sex: string; phone: string; address: string;
  problem: string; duration: string; severity: string;
}) {
  const labels = language === "हिन्दी"
    ? ["नाम", "उम्र", "लिंग", "मोबाइल", "पता", "मरीज की मुख्य समस्या", "अवधि", "गंभीरता"]
    : language === "தமிழ்"
      ? ["பெயர்", "வயது", "பாலினம்", "கைபேசி", "முகவரி", "நோயாளர் கூறிய முக்கிய பிரச்சனை", "கால அளவு", "தீவிரம்"]
      : ["Name", "Age", "Sex", "Phone", "Address", "Patient-reported main concern", "Duration", "Severity"];
  return [
    `${labels[0]}: ${details.name}.`, `${labels[1]}: ${details.age}.`,
    `${labels[2]}: ${details.sex}.`, `${labels[3]}: ${details.phone}.`,
    `${labels[4]}: ${details.address}.`, `${labels[5]}: ${details.problem}.`,
    `${labels[6]}: ${details.duration}.`, `${labels[7]}: ${details.severity}.`,
  ].join(" ");
}

async function createGuidedVoiceMessage(request: Request, patientUsername: string) {
  let payload: Record<string, unknown>;
  try {
    payload = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid guided voice intake." }, { status: 400 });
  }
  const age = String(payload.age ?? "").replace(/\s+/g, " ").trim().slice(0, 30);
  const sex = String(payload.sex ?? "").trim();
  const address = String(payload.address ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  const problem = String(payload.problem ?? "").replace(/\s+/g, " ").trim().slice(0, 1200);
  const fields: VoiceFields = {
    patientName: String(payload.patientName ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
    phone: normalizePhone(String(payload.phone ?? "")),
    department: String(payload.department ?? "").trim(),
    doctorId: String(payload.doctorId ?? "").trim(),
    doctorName: String(payload.doctorName ?? "").trim(),
    language: String(payload.language ?? "English").trim(),
    urgency: "Routine",
    symptomCategory: String(payload.symptomCategory ?? "").trim(),
    symptomDuration: String(payload.symptomDuration ?? "").replace(/\s+/g, " ").trim().slice(0, 160),
    severity: String(payload.severity ?? "").trim(),
    durationSeconds: 0,
    transcript: "",
  };
  fields.transcript = guidedTranscript(fields.language, {
    name: fields.patientName, age, sex, phone: fields.phone, address,
    problem, duration: fields.symptomDuration, severity: fields.severity,
  });
  const emergencyPattern = /chest pain|cannot breathe|difficulty breathing|unconscious|heavy bleeding|seizure|सीने में दर्द|सांस नहीं|साँस नहीं|बेहोश|बहुत खून|दौरा|நெஞ்சு வலி|மூச்சு விட முடிய|மயக்கம்|அதிக இரத்தப்போக்கு|வலிப்பு/i;
  fields.urgency = fields.severity === "Severe" || emergencyPattern.test(problem) ? "Urgent" : "Routine";
  if (
    payload.consent !== true || !age || !address || problem.length < 3 ||
    !["Male", "Female", "Rather not to say"].includes(sex) ||
    !validFields(fields) || !(await validDoctorReferral(fields))
  ) {
    return Response.json({ error: "Complete and confirm every guided intake answer before sending." }, { status: 400 });
  }

  const aiConfig = {
    apiKey: env.OPENAI_API_KEY,
    textModel: env.OPENAI_TEXT_MODEL,
    transcriptionModel: env.OPENAI_TRANSCRIPTION_MODEL,
  };
  let summary = createVoiceSummary(fields);
  let summaryMode: "deterministic" | "openai-reviewed" = "deterministic";
  if (openAIConfigured(aiConfig)) {
    try {
      summary = await summarizeVoiceForDoctor(aiConfig, fields, fields.transcript);
      summaryMode = "openai-reviewed";
    } catch {
      // The deterministic multilingual summary remains available.
    }
  }
  const result = await env.DB.prepare(
    `INSERT INTO direct_voice_messages (
      patient_username, patient_name, phone, department, doctor_id, doctor_name,
      language, urgency, symptom_category, symptom_duration, severity,
      object_key, mime_type, size_bytes, duration_seconds, transcript, summary
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 'text/plain', 0, 0, ?, ?)`,
  ).bind(
    patientUsername, fields.patientName, fields.phone, fields.department,
    fields.doctorId, fields.doctorName, fields.language, fields.urgency,
    fields.symptomCategory, fields.symptomDuration, fields.severity,
    fields.transcript, summary,
  ).run();
  const id = Number(result.meta.last_row_id);
  await env.DB.prepare(
    `INSERT INTO audit_events
      (actor_username, actor_role, action, resource_type, resource_id, detail_json)
     VALUES (?, 'patient', 'guided-voice-intake-submitted', 'direct_voice_message', ?, ?)`,
  ).bind(patientUsername, String(id), JSON.stringify({
    doctorId: fields.doctorId, language: fields.language, urgency: fields.urgency,
    consent: true, source: "patient-voice-guide",
  })).run();
  return Response.json({
    id, status: "new", summary, transcript: fields.transcript,
    summaryMode, source: "patient-voice-guide",
  }, { status: 201 });
}

export async function GET(request: Request) {
  const session = await getAppSession(request);
  if (!session)
    return Response.json({ error: "Sign in required." }, { status: 401 });

  const audioId = Number(new URL(request.url).searchParams.get("audio"));
  if (Number.isInteger(audioId) && audioId > 0) {
    const row = await env.DB.prepare(
      "SELECT object_key, mime_type, patient_username, doctor_id FROM direct_voice_messages WHERE id = ?",
    )
      .bind(audioId)
      .first<VoiceRow>();
    const doctorId = session.role === "doctor" ? scopedDoctorId(session.username) : null;
    if (!row ||
      (session.role === "doctor" && doctorId && row.doctor_id !== doctorId) ||
      (session.role === "patient" && row.patient_username !== session.username))
      return Response.json(
        { error: "Voice message not found." },
        { status: 404 },
      );
    const object = await getD1File(row.object_key);
    if (!object)
      return Response.json({ error: "Audio is unavailable." }, { status: 404 });
    return new Response(object.bytes, {
      headers: {
        "Content-Type": row.mime_type,
        ...(object.sizeBytes ? { "Content-Length": String(object.sizeBytes) } : {}),
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="voice-message-${audioId}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const columns = `id, patient_username, patient_name, phone, department, doctor_id, doctor_name,
    language, urgency, symptom_category, symptom_duration, severity,
    mime_type, size_bytes, duration_seconds, transcript, summary,
    status, doctor_note, created_at,
    (SELECT abha_number FROM patient_abha_profiles a WHERE a.username = direct_voice_messages.patient_username) AS abha_number,
    (SELECT verification_status FROM patient_abha_profiles a WHERE a.username = direct_voice_messages.patient_username) AS abha_status`;
  const doctorId = session.role === "doctor" ? scopedDoctorId(session.username) : null;
  const statement =
    session.role === "doctor" && doctorId
      ? env.DB.prepare(
          `SELECT ${columns} FROM direct_voice_messages
           WHERE doctor_id = ? ORDER BY created_at DESC LIMIT 100`,
        ).bind(doctorId)
      : session.role === "doctor"
        ? env.DB.prepare(
          `SELECT ${columns} FROM direct_voice_messages
           ORDER BY created_at DESC LIMIT 100`,
        )
      : env.DB.prepare(
          `SELECT ${columns} FROM direct_voice_messages
           WHERE patient_username = ? ORDER BY created_at DESC LIMIT 25`,
        ).bind(session.username);
  const result = await statement.all();
  return Response.json({ messages: result.results });
}

export async function POST(request: Request) {
  const session = await getAppSession(request);
  if (!session || session.role !== "patient")
    return Response.json(
      { error: "Patient sign-in required." },
      { status: 403 },
    );

  if (request.headers.get("content-type")?.includes("application/json"))
    return createGuidedVoiceMessage(request, session.username);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid voice form." }, { status: 400 });
  }
  const fields = readFields(form);
  const audio = form.get("voice");
  if (
    !validFields(fields, false) ||
    !validAudio(audio) ||
    !(await validDoctorReferral(fields))
  )
    return Response.json(
      {
        error:
          "Complete patient, doctor and symptom details, then attach a voice recording under 1.5 MB.",
      },
      { status: 400 },
    );

  let transcriptionMode: "patient-reviewed" | "openai-server" = "patient-reviewed";
  const aiConfig = {
    apiKey: env.OPENAI_API_KEY,
    textModel: env.OPENAI_TEXT_MODEL,
    transcriptionModel: env.OPENAI_TRANSCRIPTION_MODEL,
  };
  if (fields.transcript.length < 2) {
    if (!openAIConfigured(aiConfig))
      return Response.json(
        { error: "Live captions were unavailable and server speech recognition is not configured. Type the caption or configure OPENAI_API_KEY." },
        { status: 503 },
      );
    try {
      fields.transcript = await transcribeMedicalAudio(aiConfig, audio, fields.language);
      transcriptionMode = "openai-server";
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "The recording could not be transcribed." },
        { status: 502 },
      );
    }
  }

  const mimeType = audio.type.split(";")[0].toLowerCase();
  const objectKey = `direct-voice/${session.username}/${crypto.randomUUID()}.${extensionFor(mimeType)}`;
  const deterministicSummary = createVoiceSummary(fields);
  let summary = deterministicSummary;
  let summaryMode: "deterministic" | "openai-reviewed" = "deterministic";
  if (openAIConfigured(aiConfig)) {
    try {
      summary = await summarizeVoiceForDoctor(aiConfig, fields, fields.transcript);
      summaryMode = "openai-reviewed";
    } catch {
      summary = deterministicSummary;
    }
  }
  await putD1File({
    objectKey,
    ownerUsername: session.username,
    category: "direct-voice",
    fileName: `voice-message.${extensionFor(mimeType)}`,
    contentType: mimeType,
    bytes: await audio.arrayBuffer(),
  });
  try {
    const result = await env.DB.prepare(
      `INSERT INTO direct_voice_messages (
        patient_username, patient_name, phone, department, doctor_id, doctor_name,
        language, urgency, symptom_category, symptom_duration, severity,
        object_key, mime_type, size_bytes, duration_seconds, transcript, summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        session.username,
        fields.patientName,
        fields.phone,
        fields.department,
        fields.doctorId,
        fields.doctorName,
        fields.language,
        fields.urgency,
        fields.symptomCategory,
        fields.symptomDuration,
        fields.severity,
        objectKey,
        mimeType,
        audio.size,
        Math.min(fields.durationSeconds, 180),
        fields.transcript,
        summary,
      )
      .run();
    return Response.json(
      { id: result.meta.last_row_id, status: "new", summary, transcript: fields.transcript, transcriptionMode, summaryMode },
      { status: 201 },
    );
  } catch (error) {
    await deleteD1File(objectKey);
    throw error;
  }
}

export async function PATCH(request: Request) {
  const session = await getAppSession(request);
  if (!session || session.role !== "patient")
    return Response.json(
      { error: "Patient sign-in required." },
      { status: 403 },
    );
  const form = await request.formData();
  const id = Number(form.get("id"));
  const fields = readFields(form);
  if (
    !Number.isInteger(id) ||
    !validFields(fields) ||
    !(await validDoctorReferral(fields))
  )
    return Response.json(
      { error: "Complete all patient, doctor and symptom details." },
      { status: 400 },
    );

  const existing = await env.DB.prepare(
    "SELECT object_key, patient_username FROM direct_voice_messages WHERE id = ?",
  )
    .bind(id)
    .first<{ object_key: string; patient_username: string }>();
  if (!existing || existing.patient_username !== session.username)
    return Response.json(
      { error: "Voice message not found." },
      { status: 404 },
    );

  const audio = form.get("voice");
  let objectKey = existing.object_key;
  let mimeType: string | null = null;
  let sizeBytes: number | null = null;
  let replacementKey = "";
  if (audio instanceof File && audio.size > 0) {
    if (!validAudio(audio))
      return Response.json(
        { error: "Choose a valid audio recording under 1.5 MB." },
        { status: 400 },
      );
    mimeType = audio.type.split(";")[0].toLowerCase();
    replacementKey = `direct-voice/${session.username}/${crypto.randomUUID()}.${extensionFor(mimeType)}`;
    await putD1File({
      objectKey: replacementKey,
      ownerUsername: session.username,
      category: "direct-voice",
      fileName: `voice-message.${extensionFor(mimeType)}`,
      contentType: mimeType,
      bytes: await audio.arrayBuffer(),
    });
    objectKey = replacementKey;
    sizeBytes = audio.size;
  }

  const summary = createVoiceSummary(fields);
  try {
    const result = await env.DB.prepare(
      `UPDATE direct_voice_messages SET
        patient_name = ?, phone = ?, department = ?, doctor_id = ?, doctor_name = ?,
        language = ?, urgency = ?, symptom_category = ?, symptom_duration = ?,
        severity = ?, object_key = ?, mime_type = COALESCE(?, mime_type),
        size_bytes = COALESCE(?, size_bytes), duration_seconds = ?,
        transcript = ?, summary = ?, status = 'new'
       WHERE id = ? AND patient_username = ?`,
    )
      .bind(
        fields.patientName,
        fields.phone,
        fields.department,
        fields.doctorId,
        fields.doctorName,
        fields.language,
        fields.urgency,
        fields.symptomCategory,
        fields.symptomDuration,
        fields.severity,
        objectKey,
        mimeType,
        sizeBytes,
        Math.min(fields.durationSeconds, 180),
        fields.transcript,
        summary,
        id,
        session.username,
      )
      .run();
    if (!result.meta.changes) throw new Error("Voice update failed.");
    if (replacementKey) await deleteD1File(existing.object_key);
    return Response.json({ ok: true, id, summary });
  } catch (error) {
    if (replacementKey) await deleteD1File(replacementKey);
    throw error;
  }
}

export async function PUT(request: Request) {
  const session = await getAppSession(request);
  if (!session || session.role !== "doctor")
    return Response.json(
      { error: "Doctor sign-in required." },
      { status: 403 },
    );
  const payload = (await request.json()) as {
    id?: number;
    status?: string;
    doctorNote?: string;
  };
  if (
    !Number.isInteger(payload.id) ||
    !["new", "heard", "completed"].includes(payload.status ?? "")
  )
    return Response.json({ error: "Valid update required." }, { status: 400 });
  const doctorId = scopedDoctorId(session.username);
  const statement = doctorId
    ? env.DB.prepare(
        "UPDATE direct_voice_messages SET status = ?, doctor_note = ? WHERE id = ? AND doctor_id = ?",
      ).bind(payload.status, String(payload.doctorNote ?? "").trim().slice(0, 2000), payload.id, doctorId)
    : env.DB.prepare(
        "UPDATE direct_voice_messages SET status = ?, doctor_note = ? WHERE id = ?",
      ).bind(payload.status, String(payload.doctorNote ?? "").trim().slice(0, 2000), payload.id);
  const result = await statement.run();
  if (!result.meta.changes)
    return Response.json({ error: "Voice message not found." }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await getAppSession(request);
  if (!session)
    return Response.json({ error: "Sign in required." }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1)
    return Response.json(
      { error: "Valid voice message required." },
      { status: 400 },
    );

  const row = await env.DB.prepare(
    "SELECT object_key, patient_username, doctor_id FROM direct_voice_messages WHERE id = ?",
  )
    .bind(id)
    .first<{ object_key: string; patient_username: string; doctor_id: string }>();
  const doctorId = session.role === "doctor" ? scopedDoctorId(session.username) : null;
  if (
    !row ||
    (session.role === "doctor" && doctorId && row.doctor_id !== doctorId) ||
    (session.role === "patient" && row.patient_username !== session.username)
  )
    return Response.json(
      { error: "Voice message not found." },
      { status: 404 },
    );

  await deleteD1File(row.object_key);
  await env.DB.prepare("DELETE FROM direct_voice_messages WHERE id = ?")
    .bind(id)
    .run();
  return Response.json({ ok: true });
}
