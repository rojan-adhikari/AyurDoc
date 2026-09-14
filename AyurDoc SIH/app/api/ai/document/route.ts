import { env } from "cloudflare:workers";
import { getAppSession } from "../../../../lib/session";
import { extractMedicalImage, openAIConfigured } from "../../../../lib/openai-integration";

export async function POST(request: Request) {
  const session = await getAppSession(request);
  if (!session || session.role !== "patient") return Response.json({ error: "Patient sign-in required." }, { status: 403 });
  const payload = await request.json().catch(() => null) as null | { dataUrl?: string; consent?: boolean };
  if (payload?.consent !== true) return Response.json({ error: "Consent is required before processing this document." }, { status: 400 });
  const dataUrl = String(payload?.dataUrl ?? "");
  if (!/^data:image\/(?:jpeg|png|webp);base64,/i.test(dataUrl) || dataUrl.length > 2_100_000)
    return Response.json({ error: "Upload a JPG, PNG or WebP image smaller than 1.5 MB." }, { status: 400 });
  const config = { apiKey: env.OPENAI_API_KEY, textModel: env.OPENAI_TEXT_MODEL };
  if (!openAIConfigured(config)) return Response.json({ error: "External medical OCR is not configured.", configured: false }, { status: 503 });
  try {
    const extraction = await extractMedicalImage(config, dataUrl);
    await env.DB.prepare(
      `INSERT INTO audit_events (actor_username, actor_role, action, resource_type, resource_id, detail_json)
       VALUES (?, ?, 'document.external-extraction', 'DocumentReference', ?, ?)`,
    ).bind(session.username, session.role, crypto.randomUUID(), JSON.stringify({ confidence: extraction.overallConfidence, storedByProvider: false })).run();
    return Response.json({ extraction, configured: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Document extraction is temporarily unavailable." }, { status: 502 });
  }
}
