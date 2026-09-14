import { env } from "cloudflare:workers";
import { getAppSession } from "../../../../lib/session";
import { generateAyurAIReply, openAIConfigured } from "../../../../lib/openai-integration";

export async function POST(request: Request) {
  const session = await getAppSession(request);
  if (!session) return Response.json({ error: "Sign in required." }, { status: 401 });
  const payload = await request.json().catch(() => null) as null | {
    message?: string;
    language?: string;
    consent?: boolean;
    history?: Array<{ role?: string; text?: string }>;
  };
  const message = String(payload?.message ?? "").trim();
  const language = ["English", "हिन्दी", "தமிழ்"].includes(String(payload?.language)) ? String(payload?.language) : "English";
  if (payload?.consent !== true) return Response.json({ error: "Consent is required before sending health text to the AI service." }, { status: 400 });
  if (message.length < 2 || message.length > 2000) return Response.json({ error: "Enter a health question between 2 and 2000 characters." }, { status: 400 });
  const config = { apiKey: env.OPENAI_API_KEY, textModel: env.OPENAI_TEXT_MODEL };
  if (!openAIConfigured(config)) return Response.json({ error: "AyurAI external model is not configured.", configured: false }, { status: 503 });
  try {
    const history = (payload?.history ?? []).slice(-8).flatMap((item) =>
      (item.role === "user" || item.role === "assistant") && item.text
        ? [{ role: item.role, text: String(item.text).slice(0, 1500) } as const]
        : [],
    );
    const result = await generateAyurAIReply(config, language, message, history);
    await env.DB.prepare(
      `INSERT INTO audit_events (actor_username, actor_role, action, resource_type, resource_id, detail_json)
       VALUES (?, ?, 'ayurai.external-response', 'AIInteraction', ?, ?)`,
    ).bind(session.username, session.role, crypto.randomUUID(), JSON.stringify({ language, urgency: result.urgency, model: env.OPENAI_TEXT_MODEL || "gpt-4o-mini", storedByProvider: false })).run();
    return Response.json({ ...result, configured: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "AyurAI is temporarily unavailable." }, { status: 502 });
  }
}
