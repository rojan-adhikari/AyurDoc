import { env } from "cloudflare:workers";
import { getAppSession, type AppSession } from "../../../lib/session";
import { scopedDoctorId } from "../../../lib/doctor-directory";

async function canJoin(meetingCode: string, session: AppSession) {
  const doctorId = session.role === "doctor" ? scopedDoctorId(session.username) : null;
  const query =
    session.role === "doctor" && doctorId
      ? env.DB.prepare(
          "SELECT id FROM appointments WHERE meeting_code = ? AND doctor_id = ? AND visit_mode = 'Video consultation'",
        ).bind(meetingCode, doctorId)
      : session.role === "doctor"
        ? env.DB.prepare(
          "SELECT id FROM appointments WHERE meeting_code = ? AND visit_mode = 'Video consultation'",
        ).bind(meetingCode)
      : env.DB.prepare(
          `SELECT id FROM appointments
           WHERE meeting_code = ? AND patient_username = ?
             AND visit_mode = 'Video consultation'`,
        ).bind(meetingCode, session.username);
  return Boolean(await query.first());
}

export async function GET(request: Request) {
  const session = await getAppSession(request);
  if (!session)
    return Response.json({ error: "Sign in required." }, { status: 401 });
  const meetingCode = (
    new URL(request.url).searchParams.get("meetingCode") ?? ""
  )
    .trim()
    .toUpperCase();
  if (!meetingCode || !(await canJoin(meetingCode, session)))
    return Response.json(
      { error: "Video appointment not found." },
      { status: 404 },
    );

  const signal = await env.DB.prepare(
    "SELECT offer_sdp, answer_sdp, updated_at FROM video_signals WHERE meeting_code = ?",
  )
    .bind(meetingCode)
    .first<{ offer_sdp: string; answer_sdp: string; updated_at: string }>();
  return Response.json({
    offer: signal?.offer_sdp ? JSON.parse(signal.offer_sdp) : null,
    answer: signal?.answer_sdp ? JSON.parse(signal.answer_sdp) : null,
    updatedAt: signal?.updated_at ?? null,
  });
}

export async function POST(request: Request) {
  const session = await getAppSession(request);
  if (!session)
    return Response.json({ error: "Sign in required." }, { status: 401 });
  const payload = (await request.json()) as {
    meetingCode?: string;
    kind?: "offer" | "answer";
    description?: { type?: string; sdp?: string };
  };
  const meetingCode = String(payload.meetingCode ?? "")
    .trim()
    .toUpperCase();
  const description = payload.description;
  const expectedKind = session.role === "patient" ? "offer" : "answer";
  if (
    payload.kind !== expectedKind ||
    description?.type !== payload.kind ||
    !description.sdp ||
    description.sdp.length > 120_000 ||
    !(await canJoin(meetingCode, session))
  )
    return Response.json({ error: "Invalid video signal." }, { status: 400 });

  const serialized = JSON.stringify({
    type: description.type,
    sdp: description.sdp,
  });
  if (payload.kind === "offer") {
    await env.DB.prepare(
      `INSERT INTO video_signals (meeting_code, offer_sdp, answer_sdp, updated_at)
       VALUES (?, ?, '', CURRENT_TIMESTAMP)
       ON CONFLICT(meeting_code) DO UPDATE SET
         offer_sdp = excluded.offer_sdp,
         answer_sdp = '',
         updated_at = CURRENT_TIMESTAMP`,
    )
      .bind(meetingCode, serialized)
      .run();
  } else {
    await env.DB.prepare(
      `UPDATE video_signals SET answer_sdp = ?, updated_at = CURRENT_TIMESTAMP
       WHERE meeting_code = ? AND offer_sdp != ''`,
    )
      .bind(serialized, meetingCode)
      .run();
  }
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await getAppSession(request);
  if (!session)
    return Response.json({ error: "Sign in required." }, { status: 401 });
  const meetingCode = (
    new URL(request.url).searchParams.get("meetingCode") ?? ""
  )
    .trim()
    .toUpperCase();
  if (!(await canJoin(meetingCode, session)))
    return Response.json(
      { error: "Video appointment not found." },
      { status: 404 },
    );
  await env.DB.prepare("DELETE FROM video_signals WHERE meeting_code = ?")
    .bind(meetingCode)
    .run();
  return Response.json({ ok: true });
}
