import { env } from "cloudflare:workers";
import { getAppSession } from "../../../lib/session";
import { scopedDoctorId } from "../../../lib/doctor-directory";
import { getD1File } from "../../../lib/d1-file-storage";

type DocumentRow = {
  object_key: string;
  content_type: string;
  file_name: string;
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
    `SELECT d.object_key, d.content_type, d.file_name, d.patient_username, p.doctor_id
     FROM medical_documents d JOIN patient_intakes p ON p.id = d.intake_id
     WHERE d.intake_id = ?`,
  )
    .bind(intakeId)
    .first<DocumentRow>();
  const doctorId = session.role === "doctor" ? scopedDoctorId(session.username) : null;
  if (!row ||
    (session.role === "doctor" && doctorId && row.doctor_id !== doctorId) ||
    (session.role === "patient" && row.patient_username !== session.username))
    return Response.json(
      { error: "Medical document not found." },
      { status: 404 },
    );

  const object = await getD1File(row.object_key);
  if (!object)
    return Response.json(
      { error: "Document file is unavailable." },
      { status: 404 },
    );

  const safeName = row.file_name.replace(/[\r\n"\\]/g, "_");
  return new Response(object.bytes, {
    headers: {
      "Content-Type": row.content_type,
      ...(object.sizeBytes ? { "Content-Length": String(object.sizeBytes) } : {}),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="${safeName}"`,
    },
  });
}
