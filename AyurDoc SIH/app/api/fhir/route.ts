import { env } from "cloudflare:workers";
import { getAppSession } from "../../../lib/session";
import { scopedDoctorId } from "../../../lib/doctor-directory";

type ExportRow = {
  patient_username: string;
  doctor_id: string;
  fhir_bundle_json: string;
  consent_status: string | null;
  decision?: string;
};

async function readAuthorizedBundle(request: Request, intakeId: number) {
  const session = await getAppSession(request);
  if (!session) return { error: Response.json({ error: "Sign in required." }, { status: 401 }) };
  const row = await env.DB.prepare(
    `SELECT p.patient_username, p.doctor_id, w.fhir_bundle_json, w.decision,
      (SELECT status FROM consent_records c WHERE c.intake_id = p.id ORDER BY c.id DESC LIMIT 1) AS consent_status
     FROM patient_intakes p JOIN clinical_workflow_records w ON w.intake_id = p.id WHERE p.id = ?`,
  ).bind(intakeId).first<ExportRow>();
  const doctorId = session.role === "doctor" ? scopedDoctorId(session.username) : null;
  const allowed = row && (session.role === "admin" || (session.role === "patient" && row.patient_username === session.username) || (session.role === "doctor" && (!doctorId || row.doctor_id === doctorId)));
  if (!allowed) return { error: Response.json({ error: "FHIR record not found." }, { status: 404 }) };
  if (row.consent_status !== "granted") return { error: Response.json({ error: "Active patient consent is required for FHIR exchange." }, { status: 403 }) };
  let bundle: unknown;
  try { bundle = JSON.parse(row.fhir_bundle_json); } catch { return { error: Response.json({ error: "Stored FHIR record is invalid." }, { status: 500 }) } };
  const validation = validateBundle(bundle);
  if (!validation.valid) return { error: Response.json({ error: "FHIR structural validation failed.", issues: validation.issues }, { status: 422 }) };
  return { session, row, bundle };
}

export async function GET(request: Request) {
  const session = await getAppSession(request);
  if (!session)
    return Response.json({ error: "Sign in required." }, { status: 401 });
  const intakeId = Number(new URL(request.url).searchParams.get("intakeId"));
  if (!Number.isInteger(intakeId) || intakeId < 1)
    return Response.json({ error: "Valid intake required." }, { status: 400 });

  const row = await env.DB.prepare(
    `SELECT p.patient_username, p.doctor_id, w.fhir_bundle_json,
      (SELECT status FROM consent_records c WHERE c.intake_id = p.id
       ORDER BY c.id DESC LIMIT 1) AS consent_status
     FROM patient_intakes p
     JOIN clinical_workflow_records w ON w.intake_id = p.id
     WHERE p.id = ?`,
  ).bind(intakeId).first<ExportRow>();
  const doctorId = session.role === "doctor" ? scopedDoctorId(session.username) : null;
  const allowed = row && (
    session.role === "admin" ||
    (session.role === "patient" && row.patient_username === session.username) ||
    (session.role === "doctor" && (!doctorId || row.doctor_id === doctorId))
  );
  if (!allowed)
    return Response.json({ error: "FHIR record not found." }, { status: 404 });
  if (row.consent_status !== "granted")
    return Response.json({ error: "Active patient consent is required for FHIR export." }, { status: 403 });

  let bundle: unknown;
  try { bundle = JSON.parse(row.fhir_bundle_json); }
  catch { return Response.json({ error: "Stored FHIR record is invalid." }, { status: 500 }); }
  const validation = validateBundle(bundle);
  if (!validation.valid)
    return Response.json({ error: "FHIR structural validation failed.", issues: validation.issues }, { status: 422 });

  await env.DB.prepare(
    `INSERT INTO audit_events (
      intake_id, actor_username, actor_role, action, resource_type, resource_id, detail_json
    ) VALUES (?, ?, ?, 'fhir-bundle.exported', 'Bundle', ?, ?)`,
  ).bind(intakeId, session.username, session.role, `ayurdoc-intake-${intakeId}`,
    JSON.stringify({ format: "application/fhir+json", structuralValidation: "passed" })).run();

  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      "Content-Type": "application/fhir+json; charset=utf-8",
      "Content-Disposition": `attachment; filename="ayurdoc-intake-${intakeId}-fhir.json"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-AyurDoc-FHIR-Check": "structural-pass",
    },
  });
}

export async function POST(request: Request) {
  const session = await getAppSession(request);
  if (!session || (session.role !== "doctor" && session.role !== "admin"))
    return Response.json({ error: "Doctor or administrator sign-in required." }, { status: 403 });
  const payload = await request.json().catch(() => null) as null | { intakeId?: number; confirmExchange?: boolean };
  const intakeId = Number(payload?.intakeId);
  if (!Number.isInteger(intakeId) || intakeId < 1 || payload?.confirmExchange !== true)
    return Response.json({ error: "Select a valid intake and explicitly confirm the exchange." }, { status: 400 });
  const access = await readAuthorizedBundle(request, intakeId);
  if (access.error) return access.error;
  if (access.row?.decision !== "confirmed")
    return Response.json({ error: "The assigned physician must confirm the clinical summary before hospital exchange." }, { status: 409 });
  const baseUrl = String(env.FHIR_BASE_URL ?? "").replace(/\/$/, "");
  if (!/^https:\/\//i.test(baseUrl))
    return Response.json({ error: "A secure FHIR R4 server endpoint is not configured.", configured: false }, { status: 503 });
  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/fhir+json",
      Accept: "application/fhir+json",
      ...(env.FHIR_AUTH_TOKEN ? { Authorization: `Bearer ${env.FHIR_AUTH_TOKEN}` } : {}),
    },
    body: JSON.stringify(access.bundle),
  });
  const responseText = (await response.text()).slice(0, 4000);
  await env.DB.prepare(
    `INSERT INTO audit_events (intake_id, actor_username, actor_role, action, resource_type, resource_id, detail_json)
     VALUES (?, ?, ?, ?, 'Bundle', ?, ?)`,
  ).bind(intakeId, session.username, session.role, response.ok ? "fhir-bundle.sent" : "fhir-bundle.failed", `ayurdoc-intake-${intakeId}`, JSON.stringify({ endpointOrigin: new URL(baseUrl).origin, status: response.status, location: response.headers.get("location") })).run();
  if (!response.ok)
    return Response.json({ error: "The hospital FHIR server rejected the Bundle.", status: response.status, operationOutcome: responseText }, { status: 502 });
  let fhirResponse: unknown = null;
  try { fhirResponse = responseText ? JSON.parse(responseText) : null; } catch { fhirResponse = responseText; }
  return Response.json({ ok: true, status: response.status, location: response.headers.get("location"), response: fhirResponse });
}

function validateBundle(value: unknown) {
  const issues: string[] = [];
  if (!value || typeof value !== "object") issues.push("Bundle must be an object.");
  const bundle = (value ?? {}) as { resourceType?: unknown; type?: unknown; entry?: unknown };
  if (bundle.resourceType !== "Bundle") issues.push("resourceType must be Bundle.");
  if (bundle.type !== "document") issues.push("Bundle type must be document.");
  if (!Array.isArray(bundle.entry) || bundle.entry.length < 3) issues.push("Bundle entries are incomplete.");
  const first = Array.isArray(bundle.entry) ? bundle.entry[0] as { resource?: { resourceType?: unknown } } : null;
  if (first?.resource?.resourceType !== "Composition") issues.push("A document Bundle must start with Composition.");
  return { valid: issues.length === 0, issues };
}
