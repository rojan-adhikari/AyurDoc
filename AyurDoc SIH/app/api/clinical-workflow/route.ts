import { env } from "cloudflare:workers";
import { getAppSession } from "../../../lib/session";
import { scopedDoctorId } from "../../../lib/doctor-directory";
import { createClinicalWorkflow } from "../../../lib/clinical-workflow";
import { sendVerifiedCaseEmail, type CaseEmailEnvironment } from "../../../lib/verified-case-email";

type WorkflowRow = {
  intake_id: number;
  patient_username: string;
  doctor_id: string;
  schema_version: string;
  structured_json: string;
  physician_summary: string;
  fhir_bundle_json: string;
  completeness_score: number;
  red_flag_codes: string;
  decision: string;
  review_note: string;
  reviewed_by: string;
  reviewed_at: string | null;
  updated_at: string;
};

type IntakeSourceRow = {
  id: number; patient_username: string; doctor_id: string; full_name: string;
  age: number; sex: string; phone: string; address: string; department: string; doctor_name: string; language: string;
  complaint: string; onset: string; symptoms: string; conditions: string; allergies: string;
  narrative: string; document_name: string; document_type: string; document_feedback: string;
  consented_at: string;
};

function safeParse(value: string, fallback: unknown) {
  try { return JSON.parse(value); } catch { return fallback; }
}

async function authorizedWorkflow(request: Request, intakeId: number) {
  const session = await getAppSession(request);
  if (!session) return { error: Response.json({ error: "Sign in required." }, { status: 401 }) };
  const intake = await env.DB.prepare(
    `SELECT id, patient_username, doctor_id, full_name, age, sex, phone, address, department,
            doctor_name, language, complaint, onset, symptoms, conditions,
            allergies, narrative, document_name, document_type,
            document_feedback, consented_at
     FROM patient_intakes WHERE id = ?`,
  ).bind(intakeId).first<IntakeSourceRow>();
  const assignedDoctor = session.role === "doctor" ? scopedDoctorId(session.username) : null;
  const allowed = intake && (
    session.role === "admin" ||
    (session.role === "patient" && intake.patient_username === session.username) ||
    (session.role === "doctor" && (!assignedDoctor || intake.doctor_id === assignedDoctor))
  );
  if (!allowed) return { error: Response.json({ error: "Clinical workflow not found." }, { status: 404 }) };
  let row = await env.DB.prepare(
    "SELECT * FROM clinical_workflow_records WHERE intake_id = ?",
  ).bind(intakeId).first<WorkflowRow>();
  if (!row) {
    const generated = createClinicalWorkflow({
      intakeId,
      patientUsername: intake.patient_username,
      fullName: intake.full_name,
      age: intake.age,
      sex: intake.sex,
      department: intake.department,
      doctorId: intake.doctor_id,
      doctorName: intake.doctor_name,
      language: intake.language,
      complaint: intake.complaint,
      onset: intake.onset,
      symptoms: intake.symptoms,
      conditions: intake.conditions,
      allergies: intake.allergies,
      narrative: intake.narrative,
      documentName: intake.document_name,
      documentType: intake.document_type,
      documentFeedback: intake.document_feedback,
      consentedAt: intake.consented_at,
    });
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO clinical_workflow_records (
          intake_id, structured_json, physician_summary, fhir_bundle_json,
          completeness_score, red_flag_codes
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(intakeId, JSON.stringify(generated.structured), generated.physicianSummary,
        JSON.stringify(generated.fhirBundle), generated.completenessScore,
        JSON.stringify(generated.redFlags)),
      env.DB.prepare(
        `INSERT INTO consent_records (
          intake_id, patient_username, purpose, scope_json, status, granted_at
        ) VALUES (?, ?, ?, ?, 'granted', ?)`,
      ).bind(intakeId, intake.patient_username,
        "Clinical assessment and care coordination for this encounter",
        JSON.stringify(["clinical-intake", "doctor-review", "FHIR-export"]),
        intake.consented_at),
      env.DB.prepare(
        `INSERT INTO audit_events (
          intake_id, actor_username, actor_role, action, resource_type, resource_id, detail_json
        ) VALUES (?, ?, ?, 'clinical-workflow.backfilled', 'ClinicalWorkflow', ?, '{}')`,
      ).bind(intakeId, session.username, session.role, String(intakeId)),
    ]);
    row = await env.DB.prepare(
      "SELECT * FROM clinical_workflow_records WHERE intake_id = ?",
    ).bind(intakeId).first<WorkflowRow>();
  }
  return { session, row: row! };
}

export async function GET(request: Request) {
  const intakeId = Number(new URL(request.url).searchParams.get("intakeId"));
  if (!Number.isInteger(intakeId) || intakeId < 1)
    return Response.json({ error: "Valid intake required." }, { status: 400 });
  const access = await authorizedWorkflow(request, intakeId);
  if (access.error) return access.error;

  const [audit, clarifications, consents] = await Promise.all([
    env.DB.prepare(
      `SELECT id, actor_username, actor_role, action, resource_type, resource_id,
              detail_json, created_at
       FROM audit_events WHERE intake_id = ? ORDER BY created_at DESC, id DESC LIMIT 50`,
    ).bind(intakeId).all(),
    env.DB.prepare(
      `SELECT id, question, answer, language, status, doctor_username,
              requested_at, answered_at, closed_at
       FROM clinical_clarifications WHERE intake_id = ?
       ORDER BY requested_at DESC, id DESC`,
    ).bind(intakeId).all(),
    env.DB.prepare(
      `SELECT id, purpose, scope_json, status, policy_version, granted_at, revoked_at
       FROM consent_records WHERE intake_id = ? ORDER BY granted_at DESC, id DESC`,
    ).bind(intakeId).all(),
  ]);
  const row = access.row!;
  return Response.json({
    workflow: {
      intakeId: row.intake_id,
      schemaVersion: row.schema_version,
      structuredRecord: safeParse(row.structured_json, {}),
      physicianSummary: row.physician_summary,
      fhirBundle: safeParse(row.fhir_bundle_json, {}),
      completenessScore: row.completeness_score,
      redFlags: safeParse(row.red_flag_codes, []),
      decision: row.decision,
      reviewNote: row.review_note,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      updatedAt: row.updated_at,
    },
    audit: audit.results.map((item) => ({
      ...item,
      detail: safeParse(String(item.detail_json ?? "{}"), {}),
      detail_json: undefined,
    })),
    consents: consents.results.map((item) => ({
      ...item,
      scope: safeParse(String(item.scope_json ?? "[]"), []),
      scope_json: undefined,
    })),
    clarifications: clarifications.results,
  });
}

export async function PUT(request: Request) {
  const session = await getAppSession(request);
  if (!session)
    return Response.json({ error: "Sign in required." }, { status: 401 });
  const payload = await request.json() as {
    intakeId?: number;
    decision?: string;
    physicianSummary?: string;
    reviewNote?: string;
    action?: string;
    clarificationId?: number;
    answer?: string;
  };
  const intakeId = Number(payload.intakeId);
  if (session.role === "patient") {
    if (!Number.isInteger(intakeId) || intakeId < 1)
      return Response.json({ error: "Valid intake required." }, { status: 400 });
    const owned = await env.DB.prepare(
      "SELECT patient_username, consented_at FROM patient_intakes WHERE id = ? AND patient_username = ?",
    ).bind(intakeId, session.username).first<{ patient_username: string; consented_at: string }>();
    if (!owned)
      return Response.json({ error: "Clinical case not found." }, { status: 404 });

    if (payload.action === "answer-clarification") {
      const clarificationId = Number(payload.clarificationId);
      const answer = String(payload.answer ?? "").trim();
      if (!Number.isInteger(clarificationId) || clarificationId < 1 || answer.length < 2 || answer.length > 3000)
        return Response.json({ error: "Enter a clear response for the doctor." }, { status: 400 });
      const result = await env.DB.prepare(
        `UPDATE clinical_clarifications SET answer = ?, status = 'answered', answered_at = CURRENT_TIMESTAMP
         WHERE id = ? AND intake_id = ? AND patient_username = ? AND status = 'open'`,
      ).bind(answer, clarificationId, intakeId, session.username).run();
      if (!result.meta.changes)
        return Response.json({ error: "Open clarification request not found." }, { status: 404 });
      await env.DB.batch([
        env.DB.prepare("UPDATE patient_intakes SET status = 'in-review' WHERE id = ?").bind(intakeId),
        env.DB.prepare(
          `INSERT INTO audit_events (intake_id, actor_username, actor_role, action, resource_type, resource_id, detail_json)
           VALUES (?, ?, 'patient', 'clarification.answered', 'ClinicalClarification', ?, ?)`,
        ).bind(intakeId, session.username, String(clarificationId), JSON.stringify({ answerLength: answer.length })),
      ]);
      return Response.json({ ok: true, status: "answered" });
    }

    if (["revoke-consent", "restore-consent"].includes(payload.action ?? "")) {
      const restoring = payload.action === "restore-consent";
      const status = restoring ? "granted" : "revoked";
      const now = new Date().toISOString();
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO consent_records (
            intake_id, patient_username, purpose, scope_json, status, granted_at, revoked_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).bind(intakeId, session.username,
          "Clinical assessment and care coordination for this encounter",
          JSON.stringify(["clinical-intake", "voice", "documents", "doctor-review", "FHIR-export"]),
          status, restoring ? now : owned.consented_at, restoring ? null : now),
        env.DB.prepare(
          `INSERT INTO audit_events (intake_id, actor_username, actor_role, action, resource_type, resource_id, detail_json)
           VALUES (?, ?, 'patient', ?, 'Consent', ?, ?)`,
        ).bind(intakeId, session.username, restoring ? "consent.restored" : "consent.revoked",
          String(intakeId), JSON.stringify({ status, effectiveAt: now })),
      ]);
      return Response.json({ ok: true, status });
    }
    return Response.json({ error: "Unsupported patient workflow action." }, { status: 400 });
  }

  if (session.role !== "doctor")
    return Response.json({ error: "Doctor sign-in required." }, { status: 403 });
  if (!Number.isInteger(intakeId) || intakeId < 1 ||
      !["confirmed", "needs-clarification", "rejected"].includes(payload.decision ?? ""))
    return Response.json({ error: "Valid intake and physician decision are required." }, { status: 400 });
  const summary = String(payload.physicianSummary ?? "").trim();
  const note = String(payload.reviewNote ?? "").trim();
  if (summary.length < 20 || summary.length > 8000)
    return Response.json({ error: "Review and retain a meaningful physician summary." }, { status: 400 });
  if (payload.decision === "rejected" && note.length < 5)
    return Response.json({ error: "Explain why this generated record is rejected." }, { status: 400 });
  if (payload.decision === "needs-clarification" && note.length < 5)
    return Response.json({ error: "Write the clarification question for the patient." }, { status: 400 });

  const access = await authorizedWorkflow(request, intakeId);
  if (access.error) return access.error;
  const status = payload.decision === "confirmed" ? "verified" : payload.decision === "rejected" ? "rejected" : "in-review";
  const statements = [
    env.DB.prepare(
      `UPDATE clinical_workflow_records SET physician_summary = ?, decision = ?,
       review_note = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP WHERE intake_id = ?`,
    ).bind(summary, payload.decision, note.slice(0, 3000), session.username, intakeId),
    env.DB.prepare(
      `UPDATE patient_intakes SET status = ?, doctor_note = ?,
       verified_at = CASE WHEN ? = 'verified' THEN CURRENT_TIMESTAMP ELSE verified_at END
       WHERE id = ?`,
    ).bind(status, note.slice(0, 3000), status, intakeId),
    env.DB.prepare(
      `INSERT INTO audit_events (
        intake_id, actor_username, actor_role, action, resource_type, resource_id, detail_json
      ) VALUES (?, ?, 'doctor', ?, 'ClinicalWorkflow', ?, ?)`,
    ).bind(
      intakeId, session.username, `physician-review.${payload.decision}`,
      String(intakeId), JSON.stringify({ summaryEdited: summary !== access.row!.physician_summary, note: note.slice(0, 240) }),
    ),
  ];
  if (payload.decision === "needs-clarification") {
    statements.push(
      env.DB.prepare(
        `INSERT INTO clinical_clarifications (
          intake_id, patient_username, doctor_username, question, language
        ) SELECT id, patient_username, ?, ?, language FROM patient_intakes WHERE id = ?`,
      ).bind(session.username, note.slice(0, 3000), intakeId),
    );
  } else {
    statements.push(
      env.DB.prepare(
        `UPDATE clinical_clarifications SET status = 'closed', closed_at = CURRENT_TIMESTAMP
         WHERE intake_id = ? AND status = 'open'`,
      ).bind(intakeId),
    );
  }
  await env.DB.batch(statements);
  let emailDelivery: { status: string; reason?: string } | null = null;
  if (payload.decision === "confirmed" && access.row!.decision !== "confirmed") {
    try {
      const [patientAccount, abha] = await Promise.all([
        env.DB.prepare("SELECT email FROM user_profiles WHERE username = ?")
          .bind(access.row!.patient_username)
          .first<{ email: string }>(),
        env.DB.prepare(
          `SELECT abha_number, abha_address, verification_status
           FROM patient_abha_profiles WHERE username = ?`,
        ).bind(access.row!.patient_username).first<{
          abha_number: string; abha_address: string; verification_status: string;
        }>(),
      ]);
      const intake = (await env.DB.prepare(
        `SELECT id, patient_username, doctor_id, full_name, age, sex, phone, address,
                department, doctor_name, language, complaint, onset, symptoms,
                conditions, allergies, narrative, document_name, document_type,
                document_feedback, consented_at
         FROM patient_intakes WHERE id = ?`,
      ).bind(intakeId).first<IntakeSourceRow>())!;
      const verifiedAt = new Date().toISOString();
      emailDelivery = await sendVerifiedCaseEmail({
        intakeId,
        patientName: intake.full_name,
        patientUsername: intake.patient_username,
        patientEmail: patientAccount?.email ?? "",
        age: intake.age,
        sex: intake.sex,
        phone: intake.phone,
        address: intake.address,
        abhaNumber: abha?.abha_number ?? "",
        abhaAddress: abha?.abha_address ?? "",
        abhaStatus: abha?.verification_status ?? "not-linked",
        language: intake.language,
        department: intake.department,
        doctorName: intake.doctor_name,
        doctorId: intake.doctor_id,
        complaint: intake.complaint,
        onset: intake.onset,
        symptoms: intake.symptoms,
        conditions: intake.conditions,
        allergies: intake.allergies,
        narrative: intake.narrative,
        documentName: intake.document_name,
        documentType: intake.document_type,
        documentFeedback: intake.document_feedback,
        physicianSummary: summary,
        physicianNote: note,
        reviewedBy: session.username,
        consentedAt: intake.consented_at,
        verifiedAt,
      }, env as CaseEmailEnvironment);
      await env.DB.prepare(
        `INSERT INTO audit_events (
          intake_id, actor_username, actor_role, action, resource_type, resource_id, detail_json
        ) VALUES (?, ?, 'doctor', ?, 'ClinicalReportEmail', ?, ?)`,
      ).bind(
        intakeId,
        session.username,
        emailDelivery.status === "sent" ? "verified-report.emailed" : "verified-report.email-skipped",
        String(intakeId),
        JSON.stringify({ status: emailDelivery.status, reason: emailDelivery.reason ?? "", recipientConfigured: Boolean(patientAccount?.email) }),
      ).run();
    } catch (emailError) {
      emailDelivery = {
        status: "failed",
        reason: emailError instanceof Error ? emailError.message : "Report email failed.",
      };
    }
  }
  return Response.json({ ok: true, decision: payload.decision, status, emailDelivery });
}
