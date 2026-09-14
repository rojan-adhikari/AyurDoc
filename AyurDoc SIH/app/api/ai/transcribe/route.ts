import { env } from "cloudflare:workers";
import { getAppSession } from "../../../../lib/session";
import { openAIConfigured, transcribeMedicalAudio } from "../../../../lib/openai-integration";
import { MAX_D1_FILE_BYTES } from "../../../../lib/d1-file-storage";

export async function POST(request: Request) {
  const session = await getAppSession(request);
  if (!session || session.role !== "patient") return Response.json({ error: "Patient sign-in required." }, { status: 403 });
  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  const language = String(form?.get("language") ?? "English");
  const consent = String(form?.get("consent") ?? "") === "true";
  if (!consent) return Response.json({ error: "Consent is required before sending audio to speech recognition." }, { status: 400 });
  if (!(audio instanceof File) || !audio.type.startsWith("audio/") || audio.size < 100 || audio.size > MAX_D1_FILE_BYTES)
    return Response.json({ error: "Attach a valid audio recording smaller than 1.5 MB." }, { status: 400 });
  const config = { apiKey: env.OPENAI_API_KEY, transcriptionModel: env.OPENAI_TRANSCRIPTION_MODEL };
  if (!openAIConfigured(config)) return Response.json({ error: "Server speech recognition is not configured.", configured: false }, { status: 503 });
  try {
    const transcript = await transcribeMedicalAudio(config, audio, language);
    return Response.json({ transcript, language, configured: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Speech recognition is temporarily unavailable." }, { status: 502 });
  }
}
