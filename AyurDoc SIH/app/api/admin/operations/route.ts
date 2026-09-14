import { env } from "cloudflare:workers";
import { getAppSession } from "../../../../lib/session";

const INVENTORY_DEFAULTS = [
  { itemKey: "bed:OPD Observation", category: "bed", label: "OPD Observation", totalCount: 18 },
  { itemKey: "bed:ICU", category: "bed", label: "ICU", totalCount: 6 },
  { itemKey: "bed:CCU", category: "bed", label: "CCU", totalCount: 4 },
  { itemKey: "bed:General Ward", category: "bed", label: "General Ward", totalCount: 42 },
  { itemKey: "bed:Private Ward", category: "bed", label: "Private Ward", totalCount: 12 },
  ...["A+:24", "A-:8", "B+:20", "B-:7", "O+:31", "O-:10", "AB+:12", "AB-:5"].map((item) => {
    const separator = item.lastIndexOf(":");
    const label = item.slice(0, separator);
    return { itemKey: `blood:${label}`, category: "blood", label, totalCount: Number(item.slice(separator + 1)) };
  }),
  { itemKey: "component:Packed Red Blood Cells", category: "component", label: "Packed Red Blood Cells", totalCount: 64 },
  { itemKey: "component:Plasma", category: "component", label: "Plasma", totalCount: 38 },
  { itemKey: "component:Platelets", category: "component", label: "Platelets", totalCount: 22 },
];

const RESOURCE_RULES = {
  intakes: {
    table: "patient_intakes",
    statuses: ["submitted", "in-review", "verified", "rejected", "archived"],
  },
  voice: {
    table: "direct_voice_messages",
    statuses: ["new", "heard", "completed", "archived"],
  },
  appointments: {
    table: "appointments",
    statuses: ["confirmed", "completed", "cancelled", "archived"],
  },
  emergencies: {
    table: "emergency_requests",
    statuses: ["alerted", "dispatched", "admitted", "completed", "archived"],
  },
  bloodRequests: {
    table: "blood_requests",
    statuses: ["requested", "matched", "fulfilled", "cancelled", "archived"],
  },
  donations: {
    table: "donors",
    statuses: ["scheduled", "screened", "completed", "cancelled", "archived"],
  },
  clarifications: {
    table: "clinical_clarifications",
    statuses: ["open", "answered", "closed"],
  },
} as const;

async function requireAdmin(request: Request) {
  const session = await getAppSession(request);
  return session?.role === "admin" ? session : null;
}

export async function GET(request: Request) {
  if (!(await requireAdmin(request)))
    return Response.json({ error: "Administrator sign-in required." }, { status: 403 });

  const [
    patients, intakes, voice, appointments, emergencies, bloodRequests, donations,
    workflows, clarifications, documents, consents, audit, identities, abha, inventoryRows,
  ] =
    await Promise.all([
      env.DB.prepare(
        `SELECT patient_username, full_name, MAX(age) AS age, MAX(sex) AS sex,
                MAX(phone) AS phone, MAX(address) AS address,
                MAX(department) AS department, MAX(doctor_name) AS doctor_name,
                COUNT(*) AS intake_count, MAX(created_at) AS last_seen
         FROM patient_intakes
         GROUP BY patient_username, full_name
         ORDER BY last_seen DESC LIMIT 150`,
      ).all(),
      env.DB.prepare(
        `SELECT id, patient_username, full_name, age, sex, address, phone,
                department, doctor_id, doctor_name, language, complaint, onset,
                symptoms, conditions, allergies, narrative, document_name,
                document_type, document_feedback, document_notes, status,
                doctor_note, red_flag, consented_at, verified_at, created_at
         FROM patient_intakes ORDER BY created_at DESC LIMIT 150`,
      ).all(),
      env.DB.prepare(
        `SELECT id, patient_username, patient_name, phone, department, doctor_id,
                doctor_name, language, urgency, symptom_category, symptom_duration,
                severity, mime_type, size_bytes, duration_seconds, transcript,
                summary, status, doctor_note, created_at
         FROM direct_voice_messages ORDER BY created_at DESC LIMIT 150`,
      ).all(),
      env.DB.prepare(
        `SELECT id, patient_username, patient_name, phone, doctor_id, doctor_name, department,
                visit_mode, appointment_date, time_slot, reason, meeting_code, status, created_at
         FROM appointments ORDER BY created_at DESC LIMIT 150`,
      ).all(),
      env.DB.prepare(
        `SELECT id, patient_username, patient_name, phone, bed_type, symptoms,
                ambulance, pickup_address, status, created_at
         FROM emergency_requests ORDER BY created_at DESC LIMIT 150`,
      ).all(),
      env.DB.prepare(
        `SELECT id, patient_username, patient_name, phone, blood_group, component,
                units, urgency, hospital_location, status, created_at
         FROM blood_requests ORDER BY created_at DESC LIMIT 150`,
      ).all(),
      env.DB.prepare(
        `SELECT id, patient_username, donor_name, phone, blood_group, donation_date,
                time_slot, eligible_confirmed, status, created_at
         FROM donors ORDER BY created_at DESC LIMIT 150`,
      ).all(),
      env.DB.prepare(
        `SELECT w.intake_id AS id, p.patient_username, p.full_name AS patient_name,
                p.doctor_name, p.department, w.physician_summary AS summary,
                w.completeness_score, w.decision AS status, w.review_note,
                w.reviewed_by, w.reviewed_at, w.updated_at AS created_at
         FROM clinical_workflow_records w
         JOIN patient_intakes p ON p.id = w.intake_id
         ORDER BY w.updated_at DESC LIMIT 150`,
      ).all(),
      env.DB.prepare(
        `SELECT id, intake_id, patient_username, doctor_username AS doctor_name,
                question, answer, language, status, requested_at AS created_at,
                answered_at, closed_at
         FROM clinical_clarifications ORDER BY requested_at DESC LIMIT 150`,
      ).all(),
      env.DB.prepare(
        `SELECT id, intake_id, patient_username, file_name, content_type,
                size_bytes, 'stored' AS status, created_at
         FROM medical_documents ORDER BY created_at DESC LIMIT 150`,
      ).all(),
      env.DB.prepare(
        `SELECT id, intake_id, patient_username, purpose, scope_json,
                status, policy_version, granted_at AS created_at, revoked_at
         FROM consent_records ORDER BY granted_at DESC, id DESC LIMIT 200`,
      ).all(),
      env.DB.prepare(
        `SELECT id, intake_id, actor_username AS patient_username, actor_role,
                action, resource_type, resource_id, detail_json,
                action AS status, created_at
         FROM audit_events ORDER BY created_at DESC, id DESC LIMIT 250`,
      ).all(),
      env.DB.prepare(
        `SELECT id, username AS patient_username, id_type, file_name,
                size_bytes, review_status AS status, uploaded_at AS created_at
         FROM government_ids ORDER BY uploaded_at DESC LIMIT 150`,
      ).all(),
      env.DB.prepare(
        `SELECT rowid AS id, username AS patient_username, abha_number, abha_address,
                verification_status AS status, consent_granted,
                linked_at, updated_at AS created_at
         FROM patient_abha_profiles ORDER BY updated_at DESC LIMIT 150`,
      ).all(),
      env.DB.prepare(
        `SELECT item_key, category, label, total_count, updated_at
         FROM facility_inventory ORDER BY category, label`,
      ).all(),
    ]);

  const savedInventory = new Map(
    inventoryRows.results.map((row) => [String(row.item_key), row]),
  );
  const inventory = INVENTORY_DEFAULTS.map((item) => {
    const saved = savedInventory.get(item.itemKey);
    return {
      item_key: item.itemKey,
      category: item.category,
      label: item.label,
      total_count: Number(saved?.total_count ?? item.totalCount),
      updated_at: saved?.updated_at ?? null,
    };
  });

  return Response.json({
    patients: patients.results,
    records: {
      intakes: intakes.results,
      voice: voice.results,
      appointments: appointments.results,
      emergencies: emergencies.results,
      bloodRequests: bloodRequests.results,
      donations: donations.results,
      workflows: workflows.results,
      clarifications: clarifications.results,
      documents: documents.results,
      consents: consents.results,
      audit: audit.results,
      identities: identities.results,
      abha: abha.results,
    },
    inventory,
    statusOptions: Object.fromEntries(
      Object.entries(RESOURCE_RULES).map(([key, value]) => [key, value.statuses]),
    ),
  });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin)
    return Response.json({ error: "Administrator sign-in required." }, { status: 403 });
  const payload = (await request.json()) as Record<string, unknown>;
  const resource = String(payload.resource ?? "");

  if (resource === "patient") {
    const username = String(payload.username ?? "").trim().toLowerCase();
    if (!/^[a-z][a-z0-9._-]{2,63}$/.test(username))
      return Response.json({ error: "Choose a valid patient record." }, { status: 400 });
    await env.DB.batch([
      env.DB.prepare("UPDATE patient_intakes SET status = 'archived' WHERE patient_username = ?").bind(username),
      env.DB.prepare("UPDATE direct_voice_messages SET status = 'archived' WHERE patient_username = ?").bind(username),
      env.DB.prepare("UPDATE appointments SET status = 'archived' WHERE patient_username = ?").bind(username),
      env.DB.prepare("UPDATE emergency_requests SET status = 'archived' WHERE patient_username = ?").bind(username),
      env.DB.prepare("UPDATE blood_requests SET status = 'archived' WHERE patient_username = ?").bind(username),
      env.DB.prepare("UPDATE donors SET status = 'archived' WHERE patient_username = ?").bind(username),
    ]);
    return Response.json({ ok: true, username });
  }

  if (resource === "inventory") {
    const itemKey = String(payload.itemKey ?? "");
    const match = INVENTORY_DEFAULTS.find((item) => item.itemKey === itemKey);
    const totalCount = Number(payload.totalCount);
    if (!match || !Number.isInteger(totalCount) || totalCount < 0 || totalCount > 10000)
      return Response.json({ error: "Enter a valid inventory count." }, { status: 400 });
    await env.DB.prepare(
      `INSERT INTO facility_inventory (
         item_key, category, label, total_count, updated_by, updated_at
       ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(item_key) DO UPDATE SET
         total_count = excluded.total_count,
         updated_by = excluded.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
    )
      .bind(itemKey, match.category, match.label, totalCount, admin.username)
      .run();
    return Response.json({ ok: true });
  }

  const rule = RESOURCE_RULES[resource as keyof typeof RESOURCE_RULES];
  const id = Number(payload.id);
  const status = String(payload.status ?? "");
  if (!rule || !Number.isInteger(id) || id < 1 || !(rule.statuses as readonly string[]).includes(status))
    return Response.json({ error: "Choose a valid record and status." }, { status: 400 });

  const result = await env.DB.prepare(
    `UPDATE ${rule.table} SET status = ? WHERE id = ?`,
  )
    .bind(status, id)
    .run();
  if (!result.meta.changes)
    return Response.json({ error: "Record not found." }, { status: 404 });
  return Response.json({ ok: true, id, status });
}
