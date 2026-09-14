import { env } from "cloudflare:workers";
import { getAppSession } from "../../../lib/session";
import { scopedDoctorId } from "../../../lib/doctor-directory";
import { getD1File } from "../../../lib/d1-file-storage";

type VoiceRow = {
  object_key: string;
  mime_type: string;
  patient_username: string;
  doctor_id: string;
};

export async function GET(request: Request) {
  const session = await getAppSession(request);
  if (!session)
    return Response.json({ error: "Sign in required." }, { status: 401 });

  const intakeId = Number(new URL(request.url).searchParams.get("intakeId"));
  if (!Number.isInteger(intakeId) || intakeId < 1)
    return Response.json({ error: "Valid intake required." }, { status: 400 });

  const row = await env.DB.prepare(
    `SELECT v.object_key, v.mime_type, v.patient_username, p.doctor_id
     FROM voice_messages v JOIN patient_intakes p ON p.id = v.intake_id
     WHERE v.intake_id = ?`,
  )
    .bind(intakeId)
    .first<VoiceRow>();

  const doctorId = session.role === "doctor" ? scopedDoctorId(session.username) : null;
  if (!row ||
    (session.role === "doctor" && doctorId && row.doctor_id !== doctorId) ||
    (session.role !== "doctor" && row.patient_username !== session.username))
    return Response.json(
      { error: "Voice message not found." },
      { status: 404 },
    );

  const object = await getD1File(row.object_key);
  if (!object)
    return Response.json(
      { error: "Voice media is unavailable." },
      { status: 404 },
    );

  return new Response(object.bytes, {
    headers: {
      "Content-Type": row.mime_type,
      ...(object.sizeBytes ? { "Content-Length": String(object.sizeBytes) } : {}),
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="patient-voice-${intakeId}"`,
    },
  });
}

export async function PUT(request: Request) {
  const session = await getAppSession(request);
  if (!session || session.role !== "doctor")
    return Response.json(
      { error: "Doctor sign-in required." },
      { status: 403 },
    );

  const payload = (await request.json()) as {
    intakeId?: number;
    status?: string;
  };
  if (
    !Number.isInteger(payload.intakeId) ||
    !["reviewed", "needs-clarification"].includes(payload.status ?? "")
  )
    return Response.json(
      { error: "Valid voice review required." },
      { status: 400 },
    );

  const doctorId = scopedDoctorId(session.username);
  const statement = doctorId
    ? env.DB.prepare(
        `UPDATE voice_messages SET status = ? WHERE intake_id = ?
         AND EXISTS (SELECT 1 FROM patient_intakes p WHERE p.id = voice_messages.intake_id AND p.doctor_id = ?)`,
      ).bind(payload.status, payload.intakeId, doctorId)
    : env.DB.prepare(
        "UPDATE voice_messages SET status = ? WHERE intake_id = ?",
      ).bind(payload.status, payload.intakeId);
  const result = await statement.run();
  if (!result.meta.changes)
    return Response.json({ error: "Voice message not found." }, { status: 404 });
  return Response.json({ ok: true });
}
