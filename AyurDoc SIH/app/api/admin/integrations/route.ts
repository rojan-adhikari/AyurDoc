import { env } from "cloudflare:workers";
import { getAppSession } from "../../../../lib/session";

type ServiceStatus = "ready" | "needs-configuration" | "available";

function configured(...values: unknown[]) {
  return values.every((value) => typeof value === "string" && value.trim().length > 0);
}

function service(id: string, label: string, status: ServiceStatus, detail: string, requirements: string[]) {
  return { id, label, status, detail, requirements };
}

export async function GET(request: Request) {
  const session = await getAppSession(request);
  if (!session || session.role !== "admin")
    return Response.json({ error: "Administrator sign-in required." }, { status: 403 });

  const aiReady = configured(env.OPENAI_API_KEY);
  const abdmReady = configured(env.ABDM_CLIENT_ID, env.ABDM_CLIENT_SECRET, env.ABDM_HIU_ID, env.ABDM_REQUESTER_ID);
  const fhirReady = configured(env.FHIR_BASE_URL) && /^https:\/\//i.test(String(env.FHIR_BASE_URL));
  const emailReady = configured(env.RESEND_API_KEY, env.RESEND_FROM_EMAIL);
  const services = [
    service("ai", "AyurAI, speech and document OCR", aiReady ? "ready" : "needs-configuration", aiReady ? "External AI assistance is configured." : "The safe built-in fallback remains active; image OCR and server transcription require an OpenAI key.", ["OPENAI_API_KEY"]),
    service("abdm", "ABDM sandbox consent exchange", abdmReady ? "ready" : "needs-configuration", abdmReady ? "Sandbox request credentials are configured." : "Local ABHA and consent records work; the national sandbox call is awaiting authorized credentials.", ["ABDM_CLIENT_ID", "ABDM_CLIENT_SECRET", "ABDM_HIU_ID", "ABDM_REQUESTER_ID"]),
    service("fhir", "Hospital FHIR R4 exchange", fhirReady ? "ready" : "needs-configuration", fhirReady ? "A secure hospital endpoint is configured." : "FHIR Bundles can be reviewed and exported; delivery to an external HIS needs its HTTPS endpoint.", ["FHIR_BASE_URL", "FHIR_AUTH_TOKEN when required"]),
    service("email", "Verified clinical report email", emailReady ? "ready" : "needs-configuration", emailReady ? "Physician-confirmed PDF email delivery is configured." : "Report generation works; email delivery needs the approved sender service.", ["RESEND_API_KEY", "RESEND_FROM_EMAIL"]),
    service("labels", "Medication label safety evidence", "available", "Current FDA Structured Product Labeling can be checked from the physician workspace.", []),
  ];

  return Response.json({
    services,
    safeguards: [
      "Role-based patient, doctor and administrator access",
      "Consent-gated AI, document and FHIR operations",
      "Physician confirmation before external clinical exchange",
      "HttpOnly, Secure, SameSite=Strict session cookies",
      "No-store protection for authenticated API responses",
      "Audit history for clinical and administrative actions",
    ],
  }, { headers: { "Cache-Control": "private, no-store" } });
}
