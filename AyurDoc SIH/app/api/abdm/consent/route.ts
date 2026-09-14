import { env } from "cloudflare:workers";
import { getAppSession } from "../../../../lib/session";
import { scopedDoctorId } from "../../../../lib/doctor-directory";

async function gatewayToken() {
  const baseUrl = String(env.ABDM_BASE_URL || "https://dev.abdm.gov.in").replace(/\/$/, "");
  if (!env.ABDM_CLIENT_ID || !env.ABDM_CLIENT_SECRET)
    throw new Error("ABDM sandbox client credentials are not configured.");
  const response = await fetch(`${baseUrl}/api/hiecm/gateway/v3/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ clientId: env.ABDM_CLIENT_ID, clientSecret: env.ABDM_CLIENT_SECRET, grantType: "client_credentials" }),
  });
  const payload = await response.json().catch(() => ({})) as { accessToken?: string; token?: string; error?: { message?: string } };
  const token = payload.accessToken || payload.token;
  if (!response.ok || !token) throw new Error(payload.error?.message || `ABDM session failed (${response.status}).`);
  return { token, baseUrl };
}

export async function POST(request: Request) {
  const session = await getAppSession(request);
  if (!session || (session.role !== "doctor" && session.role !== "admin"))
    return Response.json({ error: "Doctor or administrator sign-in required." }, { status: 403 });
  const payload = await request.json().catch(() => null) as null | { intakeId?: number; confirmRequest?: boolean };
  const intakeId = Number(payload?.intakeId);
  if (!Number.isInteger(intakeId) || intakeId < 1 || payload?.confirmRequest !== true)
    return Response.json({ error: "Select a valid intake and confirm the ABDM consent request." }, { status: 400 });
  const row = await env.DB.prepare(
    `SELECT p.patient_username, p.doctor_id, p.full_name, a.abha_address, a.verification_status,
      w.decision, (SELECT status FROM consent_records c WHERE c.intake_id = p.id ORDER BY c.id DESC LIMIT 1) AS consent_status
     FROM patient_intakes p
     JOIN clinical_workflow_records w ON w.intake_id = p.id
     LEFT JOIN patient_abha_profiles a ON a.username = p.patient_username
     WHERE p.id = ?`,
  ).bind(intakeId).first<{ patient_username: string; doctor_id: string; full_name: string; abha_address: string | null; verification_status: string | null; decision: string; consent_status: string | null }>();
  const doctorId = session.role === "doctor" ? scopedDoctorId(session.username) : null;
  if (!row || (session.role === "doctor" && doctorId && doctorId !== row.doctor_id))
    return Response.json({ error: "Clinical record not found." }, { status: 404 });
  if (row.decision !== "confirmed" || row.consent_status !== "granted")
    return Response.json({ error: "Physician confirmation and active local patient consent are required first." }, { status: 409 });
  if (!row.abha_address?.endsWith("@sbx"))
    return Response.json({ error: "A verified ABDM sandbox ABHA address ending in @sbx is required." }, { status: 409 });
  if (!env.ABDM_HIU_ID || !env.ABDM_REQUESTER_ID)
    return Response.json({ error: "ABDM HIU and requester identifiers are not configured.", configured: false }, { status: 503 });
  try {
    const { token, baseUrl } = await gatewayToken();
    const requestId = crypto.randomUUID();
    const now = new Date();
    const to = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const erase = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const consentRequest = {
      consent: {
        purpose: { text: "Care Management", code: "CAREMGT", refUri: "http://terminology.hl7.org/CodeSystem/v3-ActReason" },
        patient: { id: row.abha_address },
        hiu: { id: env.ABDM_HIU_ID },
        requester: { name: "AyurDoc Vaidya", identifier: { type: "REGNO", value: env.ABDM_REQUESTER_ID, system: "https://ayurdoc.medzone.in/practitioners" } },
        hiTypes: ["OPConsultation", "Prescription", "DiagnosticReport"],
        permission: {
          accessMode: "VIEW",
          dateRange: { from: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(), to: to.toISOString() },
          dataEraseAt: erase.toISOString(),
          frequency: { unit: "HOUR", value: 1, repeats: 0 },
        },
      },
    };
    const response = await fetch(`${baseUrl}/api/hiecm/consent/v3/request/init`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "REQUEST-ID": requestId,
        TIMESTAMP: new Date().toISOString(),
        "X-CM-ID": "sbx",
      },
      body: JSON.stringify(consentRequest),
    });
    const responseText = (await response.text()).slice(0, 4000);
    await env.DB.prepare(
      `INSERT INTO audit_events (intake_id, actor_username, actor_role, action, resource_type, resource_id, detail_json)
       VALUES (?, ?, ?, ?, 'ABDMConsentRequest', ?, ?)`,
    ).bind(intakeId, session.username, session.role, response.ok ? "abdm.consent-request.accepted" : "abdm.consent-request.failed", requestId, JSON.stringify({ status: response.status, patient: row.abha_address, hiu: env.ABDM_HIU_ID, response: responseText })).run();
    if (!response.ok) return Response.json({ error: "ABDM rejected the consent request.", status: response.status, detail: responseText }, { status: 502 });
    let result: unknown = responseText;
    try { result = responseText ? JSON.parse(responseText) : null; } catch { /* preserve text */ }
    return Response.json({ ok: true, requestId, status: response.status, result });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "ABDM is temporarily unavailable." }, { status: 502 });
  }
}
