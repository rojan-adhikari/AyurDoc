import { env } from "cloudflare:workers";
import { getAppSession } from "../../../lib/session";
import { isValidPhoneNumber } from "../../../lib/validation";
import { doctorForId, scopedDoctorId } from "../../../lib/doctor-directory";
import { createClinicalWorkflow } from "../../../lib/clinical-workflow";
import {
  deleteD1File,
  MAX_D1_FILE_BYTES,
  putD1File,
} from "../../../lib/d1-file-storage";

type IntakePayload = {
  fullName?: string;
  age?: number;
  sex?: string;
  address?: string;
  phone?: string;
  department?: string;
  doctorId?: string;
  doctorName?: string;
  language?: string;
  complaint?: string;
  onset?: string;
  symptoms?: string;
  conditions?: string;
  allergies?: string;
  narrative?: string;
  documentName?: string;
  documentType?: string;
  documentFeedback?: string;
  documentNotes?: string;
  documentFile?: {
    dataUrl?: string;
    fileName?: string;
    contentType?: string;
    sizeBytes?: number;
  } | null;
  voiceMessage?: {
    dataUrl?: string;
    mimeType?: string;
    durationSeconds?: number;
    transcript?: string;
  } | null;
  redFlag?: boolean;
  consentedAt?: string;
  answers?: Record<string, string[]>;
  notes?: Record<string, string>;
};

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function validDoctorReferral(payload: IntakePayload) {
  const id = payload.doctorId ?? "";
  const builtIn = doctorForId(id);
  if (builtIn)
    return builtIn.name === payload.doctorName && builtIn.department === payload.department;
  const managed = await env.DB.prepare(
    `SELECT name, department FROM doctor_directory_overrides
     WHERE doctor_id = ? AND visible = 1`,
  )
    .bind(id)
    .first<{ name: string; department: string }>();
  return managed?.name === payload.doctorName && managed.department === payload.department;
}

export async function GET(request: Request) {
  const session = await getAppSession(request);
  if (!session)
    return Response.json({ error: "Sign in required." }, { status: 401 });

  const doctorId = session.role === "doctor" ? scopedDoctorId(session.username) : null;
  const selectColumns = `p.*, v.id AS voice_message_id, v.transcript AS voice_transcript,
             v.duration_seconds AS voice_duration_seconds, v.status AS voice_status,
             d.id AS document_file_id, d.content_type AS document_content_type,
             d.size_bytes AS document_size_bytes, g.id_type AS identity_type,
             g.review_status AS identity_status, a.abha_number AS abha_number,
             a.abha_address AS abha_address,
             a.verification_status AS abha_status,
             a.consented_at AS abha_consented_at`;
  const joins = `FROM patient_intakes p
           LEFT JOIN voice_messages v ON v.intake_id = p.id
           LEFT JOIN medical_documents d ON d.intake_id = p.id
           LEFT JOIN government_ids g ON g.username = p.patient_username
           LEFT JOIN patient_abha_profiles a ON a.username = p.patient_username`;
  const statement =
    session.role === "doctor" && doctorId
      ? env.DB.prepare(
          `SELECT ${selectColumns} ${joins}
           WHERE p.doctor_id = ? ORDER BY p.red_flag DESC, p.created_at DESC LIMIT 200`,
        ).bind(doctorId)
      : session.role === "doctor"
        ? env.DB.prepare(
          `SELECT ${selectColumns} ${joins}
           ORDER BY p.red_flag DESC, p.created_at DESC LIMIT 200`,
        )
      : env.DB.prepare(
          `SELECT ${selectColumns} ${joins}
           WHERE p.patient_username = ? ORDER BY p.created_at DESC LIMIT 100`,
        ).bind(session.username);
  const result = await statement.all();
  return Response.json({ intakes: result.results });
}

export async function POST(request: Request) {
  const session = await getAppSession(request);
  if (!session || session.role !== "patient") {
    return Response.json(
      { error: "Patient sign-in required." },
      { status: 403 },
    );
  }

  const payload = (await request.json()) as IntakePayload;
  const required = [
    payload.fullName,
    payload.sex,
    payload.address,
    payload.phone,
    payload.department,
    payload.doctorId,
    payload.doctorName,
    payload.language,
    payload.complaint,
    payload.onset,
    payload.symptoms,
    payload.conditions,
    payload.allergies,
    payload.consentedAt,
  ];
  if (
    required.some((value) => !String(value ?? "").trim()) ||
    !payload.age ||
    payload.age < 1 ||
    payload.age > 120 ||
    !["Male", "Female", "Rather not to say"].includes(payload.sex ?? "") ||
    !isValidPhoneNumber(payload.phone ?? "")
  ) {
    return Response.json(
      { error: "Please complete every required patient and clinical field." },
      { status: 400 },
    );
  }
  if (!(await validDoctorReferral(payload)))
    return Response.json(
      { error: "Choose a valid Vaidya from the selected department." },
      { status: 400 },
    );

  const voice = payload.voiceMessage;
  let voiceBase64 = "";
  let voiceBytes: Uint8Array | null = null;
  let voiceMime = "";
  let voiceDuration = 0;
  if (voice?.dataUrl) {
    const match = voice.dataUrl.match(
      /^data:(audio\/(?:webm|ogg|mp4|mpeg|wav));base64,([A-Za-z0-9+/=]+)$/,
    );
    voiceMime = String(voice.mimeType ?? match?.[1] ?? "").split(";")[0];
    voiceBase64 = match?.[2] ?? "";
    voiceDuration = Math.round(Number(voice.durationSeconds));
    if (
      !match ||
      !voiceMime ||
      voiceBase64.length > 2_000_000 ||
      voiceDuration < 1 ||
      voiceDuration > 90
    ) {
      return Response.json(
        {
          error:
            "Voice message is invalid or too large. Record up to 90 seconds.",
        },
        { status: 400 },
      );
    }
    voiceBytes = decodeBase64(voiceBase64);
    if (voiceBytes.byteLength > MAX_D1_FILE_BYTES)
      return Response.json(
        { error: "Voice message is larger than the 1.5 MB demo limit." },
        { status: 400 },
      );
  }

  const documentFile = payload.documentFile;
  let documentBytes: Uint8Array | null = null;
  let documentContentType = "";
  if (documentFile?.dataUrl) {
    const match = documentFile.dataUrl.match(
      /^data:(application\/pdf|image\/(?:jpeg|png|webp|heic|heif)|text\/(?:plain|csv));base64,([A-Za-z0-9+/=]+)$/i,
    );
    documentContentType = String(documentFile.contentType ?? match?.[1] ?? "")
      .split(";")[0]
      .toLowerCase();
    const claimedSize = Number(documentFile.sizeBytes);
    if (
      !match ||
      !documentFile.fileName?.trim() ||
      !Number.isFinite(claimedSize) ||
      claimedSize < 1 ||
      claimedSize > MAX_D1_FILE_BYTES ||
      match[2].length > 2_000_000
    ) {
      return Response.json(
        { error: "Medical document is invalid or larger than 1.5 MB." },
        { status: 400 },
      );
    }
    documentBytes = decodeBase64(match[2]);
    if (documentBytes.byteLength > MAX_D1_FILE_BYTES)
      return Response.json(
        { error: "Medical document is larger than the 1.5 MB demo limit." },
        { status: 400 },
      );
  }

  const result = await env.DB.prepare(
    `INSERT INTO patient_intakes (
      patient_username, full_name, age, sex, address, phone,
      department, doctor_id, doctor_name, language,
      complaint, onset, symptoms, conditions, allergies,
      narrative, document_name, document_type, document_feedback, document_notes,
      red_flag, consented_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      session.username,
      payload.fullName!.trim(),
      payload.age,
      payload.sex!.trim(),
      payload.address!.trim(),
      payload.phone!.trim(),
      payload.department!.trim(),
      payload.doctorId!.trim(),
      payload.doctorName!.trim(),
      payload.language!.trim(),
      payload.complaint!.trim(),
      payload.onset!.trim(),
      payload.symptoms!.trim(),
      payload.conditions!.trim(),
      payload.allergies!.trim(),
      payload.narrative?.trim() ?? "",
      payload.documentName?.trim() ?? "",
      payload.documentType?.trim().slice(0, 80) ?? "",
      payload.documentFeedback?.trim().slice(0, 30000) ?? "",
      payload.documentNotes?.trim().slice(0, 2000) ?? "",
      payload.redFlag ? 1 : 0,
      payload.consentedAt,
    )
    .run();

  const intakeId = Number(result.meta.last_row_id);
  if (voiceBytes) {
    const extension = voiceMime.includes("mp4")
      ? "m4a"
      : voiceMime.includes("ogg")
        ? "ogg"
        : voiceMime.includes("mpeg")
          ? "mp3"
          : voiceMime.includes("wav")
            ? "wav"
            : "webm";
    const objectKey = `clinical/${session.username}/${intakeId}/voice-${crypto.randomUUID()}.${extension}`;
    await putD1File({
      objectKey,
      ownerUsername: session.username,
      category: "patient-voice",
      fileName: `clinical-voice.${extension}`,
      contentType: voiceMime,
      bytes: voiceBytes,
    });
    await env.DB.prepare(
      `INSERT INTO voice_messages (
        intake_id, patient_username, patient_name, department, transcript,
        object_key, mime_type, duration_seconds
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        intakeId,
        session.username,
        payload.fullName!.trim(),
        payload.department!.trim(),
        voice?.transcript?.trim().slice(0, 4000) ?? "",
        objectKey,
        voiceMime,
        voiceDuration,
      )
      .run();
  }

  if (documentBytes && documentFile) {
    const safeExtension =
      documentFile.fileName
        .split(".")
        .pop()
        ?.replace(/[^a-z0-9]/gi, "")
        .slice(0, 8) || "bin";
    const objectKey = `clinical/${session.username}/${intakeId}/document-${crypto.randomUUID()}.${safeExtension}`;
    await putD1File({
      objectKey,
      ownerUsername: session.username,
      category: "medical-document",
      fileName: documentFile.fileName,
      contentType: documentContentType,
      bytes: documentBytes,
    });
    await env.DB.prepare(
      `INSERT INTO medical_documents (
        intake_id, patient_username, file_name, content_type, size_bytes, object_key
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        intakeId,
        session.username,
        documentFile.fileName.trim().slice(0, 240),
        documentContentType,
        documentBytes.byteLength,
        objectKey,
      )
      .run();
  }

  const workflow = createClinicalWorkflow({
    intakeId,
    patientUsername: session.username,
    fullName: payload.fullName!.trim(),
    age: payload.age!,
    sex: payload.sex!.trim(),
    department: payload.department!.trim(),
    doctorId: payload.doctorId!.trim(),
    doctorName: payload.doctorName!.trim(),
    language: payload.language!.trim(),
    complaint: payload.complaint!.trim(),
    onset: payload.onset!.trim(),
    symptoms: payload.symptoms!.trim(),
    conditions: payload.conditions!.trim(),
    allergies: payload.allergies!.trim(),
    narrative: payload.narrative?.trim() ?? "",
    documentName: payload.documentName?.trim() ?? "",
    documentType: payload.documentType?.trim() ?? "",
    documentFeedback: payload.documentFeedback?.trim() ?? "",
    answers: payload.answers ?? {},
    notes: payload.notes ?? {},
    consentedAt: payload.consentedAt!,
  });
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO clinical_workflow_records (
        intake_id, structured_json, physician_summary, fhir_bundle_json,
        completeness_score, red_flag_codes
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(
      intakeId,
      JSON.stringify(workflow.structured),
      workflow.physicianSummary,
      JSON.stringify(workflow.fhirBundle),
      workflow.completenessScore,
      JSON.stringify(workflow.redFlags),
    ),
    env.DB.prepare(
      `INSERT INTO consent_records (
        intake_id, patient_username, purpose, scope_json, status, granted_at
      ) VALUES (?, ?, ?, ?, 'granted', ?)`,
    ).bind(
      intakeId,
      session.username,
      "Clinical assessment and care coordination for this encounter",
      JSON.stringify(["clinical-intake", "voice", "documents", "doctor-review", "FHIR-export"]),
      payload.consentedAt!,
    ),
    env.DB.prepare(
      `INSERT INTO audit_events (
        intake_id, actor_username, actor_role, action, resource_type, resource_id, detail_json
      ) VALUES (?, ?, 'patient', 'clinical-intake.submitted', 'ClinicalWorkflow', ?, ?)`,
    ).bind(
      intakeId,
      session.username,
      String(intakeId),
      JSON.stringify({ completenessScore: workflow.completenessScore, redFlags: workflow.redFlags.map((item) => item.code) }),
    ),
  ]);

  return Response.json(
    {
      id: intakeId,
      status: "submitted",
      voiceSaved: Boolean(voiceBytes),
      documentSaved: Boolean(documentBytes),
      clinicalWorkflowCreated: true,
      completenessScore: workflow.completenessScore,
      redFlags: workflow.redFlags,
    },
    { status: 201 },
  );
}

export async function PUT(request: Request) {
  const session = await getAppSession(request);
  if (!session)
    return Response.json({ error: "Sign in required." }, { status: 401 });

  const payload = (await request.json()) as IntakePayload & {
    id?: number;
    status?: string;
    doctorNote?: string;
  };

  if (session.role === "patient") {
    const required = [
      payload.fullName,
      payload.sex,
      payload.address,
      payload.phone,
      payload.department,
      payload.doctorId,
      payload.doctorName,
      payload.language,
      payload.complaint,
      payload.onset,
      payload.symptoms,
      payload.conditions,
      payload.allergies,
      payload.consentedAt,
    ];
    if (
      !Number.isInteger(payload.id) ||
      required.some((value) => !String(value ?? "").trim()) ||
      !payload.age ||
      payload.age < 1 ||
      payload.age > 120 ||
      !["Male", "Female", "Rather not to say"].includes(payload.sex ?? "") ||
      !isValidPhoneNumber(payload.phone ?? "")
    )
      return Response.json(
        { error: "Complete every required field before updating." },
        { status: 400 },
      );
    if (!(await validDoctorReferral(payload)))
      return Response.json(
        { error: "Choose a valid Vaidya from the selected department." },
        { status: 400 },
      );

    const result = await env.DB.prepare(
      `UPDATE patient_intakes SET
        full_name = ?, age = ?, sex = ?, address = ?, phone = ?,
        department = ?, doctor_id = ?, doctor_name = ?, language = ?,
        complaint = ?, onset = ?, symptoms = ?, conditions = ?, allergies = ?,
        narrative = ?, red_flag = ?, consented_at = ?,
        status = 'submitted', doctor_note = '', verified_at = NULL
       WHERE id = ? AND patient_username = ?`,
    )
      .bind(
        payload.fullName!.trim(),
        payload.age,
        payload.sex!.trim(),
        payload.address!.trim(),
        payload.phone!.trim(),
        payload.department!.trim(),
        payload.doctorId!.trim(),
        payload.doctorName!.trim(),
        payload.language!.trim(),
        payload.complaint!.trim(),
        payload.onset!.trim(),
        payload.symptoms!.trim(),
        payload.conditions!.trim(),
        payload.allergies!.trim(),
        payload.narrative?.trim() ?? "",
        payload.redFlag ? 1 : 0,
        payload.consentedAt,
        payload.id,
        session.username,
      )
      .run();
    if (!result.meta.changes)
      return Response.json({ error: "Intake not found." }, { status: 404 });
    const workflow = createClinicalWorkflow({
      intakeId: payload.id!,
      patientUsername: session.username,
      fullName: payload.fullName!.trim(),
      age: payload.age!,
      sex: payload.sex!.trim(),
      department: payload.department!.trim(),
      doctorId: payload.doctorId!.trim(),
      doctorName: payload.doctorName!.trim(),
      language: payload.language!.trim(),
      complaint: payload.complaint!.trim(),
      onset: payload.onset!.trim(),
      symptoms: payload.symptoms!.trim(),
      conditions: payload.conditions!.trim(),
      allergies: payload.allergies!.trim(),
      narrative: payload.narrative?.trim() ?? "",
      documentName: payload.documentName?.trim() ?? "",
      documentType: payload.documentType?.trim() ?? "",
      documentFeedback: payload.documentFeedback?.trim() ?? "",
      answers: payload.answers ?? {},
      notes: payload.notes ?? {},
      consentedAt: payload.consentedAt!,
    });
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO clinical_workflow_records (
          intake_id, structured_json, physician_summary, fhir_bundle_json,
          completeness_score, red_flag_codes
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(intake_id) DO UPDATE SET
          structured_json = excluded.structured_json,
          physician_summary = excluded.physician_summary,
          fhir_bundle_json = excluded.fhir_bundle_json,
          completeness_score = excluded.completeness_score,
          red_flag_codes = excluded.red_flag_codes,
          decision = 'pending', review_note = '', reviewed_by = '', reviewed_at = NULL,
          updated_at = CURRENT_TIMESTAMP`,
      ).bind(
        payload.id!, JSON.stringify(workflow.structured), workflow.physicianSummary,
        JSON.stringify(workflow.fhirBundle), workflow.completenessScore,
        JSON.stringify(workflow.redFlags),
      ),
      env.DB.prepare(
        `INSERT INTO audit_events (
          intake_id, actor_username, actor_role, action, resource_type, resource_id, detail_json
        ) VALUES (?, ?, 'patient', 'clinical-intake.updated', 'ClinicalWorkflow', ?, ?)`,
      ).bind(payload.id!, session.username, String(payload.id), JSON.stringify({ resetReview: true })),
    ]);
    return Response.json({ ok: true, id: payload.id, status: "submitted" });
  }

  if (
    !Number.isInteger(payload.id) ||
    !["submitted", "in-review", "verified"].includes(payload.status ?? "")
  )
    return Response.json(
      { error: "Valid intake and status are required." },
      { status: 400 },
    );

  const doctorId = scopedDoctorId(session.username);
  const query = doctorId
    ? `UPDATE patient_intakes SET status = ?, doctor_note = ?, verified_at = CASE WHEN ? = 'verified' THEN CURRENT_TIMESTAMP ELSE verified_at END WHERE id = ? AND doctor_id = ?`
    : `UPDATE patient_intakes SET status = ?, doctor_note = ?, verified_at = CASE WHEN ? = 'verified' THEN CURRENT_TIMESTAMP ELSE verified_at END WHERE id = ?`;
  const bindings = [
      payload.status,
      payload.doctorNote?.trim().slice(0, 3000) ?? "",
      payload.status,
      payload.id,
      ...(doctorId ? [doctorId] : []),
    ];
  const result = await env.DB.prepare(query).bind(...bindings).run();
  if (!result.meta.changes)
    return Response.json({ error: "Intake not found." }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await getAppSession(request);
  if (!session)
    return Response.json({ error: "Sign in required." }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1)
    return Response.json({ error: "Valid intake required." }, { status: 400 });

  const intake = await env.DB.prepare(
    "SELECT patient_username, doctor_id FROM patient_intakes WHERE id = ?",
  )
    .bind(id)
    .first<{ patient_username: string; doctor_id: string }>();
  const doctorId = session.role === "doctor" ? scopedDoctorId(session.username) : null;
  if (
    !intake ||
    (session.role === "doctor" && doctorId && intake.doctor_id !== doctorId) ||
    (session.role !== "doctor" && intake.patient_username !== session.username)
  )
    return Response.json({ error: "Intake not found." }, { status: 404 });

  const document = await env.DB.prepare(
    "SELECT object_key FROM medical_documents WHERE intake_id = ?",
  )
    .bind(id)
    .first<{ object_key: string }>();
  const voice = await env.DB.prepare(
    "SELECT object_key FROM voice_messages WHERE intake_id = ?",
  )
    .bind(id)
    .first<{ object_key: string }>();

  if (document?.object_key) await deleteD1File(document.object_key);
  if (voice?.object_key) await deleteD1File(voice.object_key);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM clinical_clarifications WHERE intake_id = ?").bind(id),
    env.DB.prepare("DELETE FROM audit_events WHERE intake_id = ?").bind(id),
    env.DB.prepare("DELETE FROM consent_records WHERE intake_id = ?").bind(id),
    env.DB.prepare("DELETE FROM clinical_workflow_records WHERE intake_id = ?").bind(id),
    env.DB.prepare("DELETE FROM medical_documents WHERE intake_id = ?").bind(
      id,
    ),
    env.DB.prepare("DELETE FROM voice_messages WHERE intake_id = ?").bind(id),
    env.DB.prepare("DELETE FROM patient_intakes WHERE id = ?").bind(id),
  ]);
  return Response.json({ ok: true });
}
