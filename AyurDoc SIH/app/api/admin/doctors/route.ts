import { env } from "cloudflare:workers";
import { getAppSession } from "../../../../lib/session";

async function requireAdmin(request: Request) {
  const session = await getAppSession(request);
  return session?.role === "admin" ? session : null;
}

function clean(value: unknown, max = 160) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function PUT(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin)
    return Response.json({ error: "Administrator sign-in required." }, { status: 403 });
  const payload = (await request.json()) as Record<string, unknown>;
  const doctorId = clean(payload.id, 60);
  const name = clean(payload.name, 120);
  const degree = clean(payload.degree, 220);
  const department = clean(payload.department, 100);
  const hours = clean(payload.hours, 120);
  const visible = payload.visible !== false;
  if (!/^[a-z][a-z0-9-]{2,59}$/.test(doctorId))
    return Response.json({ error: "A valid doctor profile ID is required." }, { status: 400 });
  if (visible && (!name || !degree || !department || !hours))
    return Response.json(
      { error: "Name, qualification, department and clinic hours are required." },
      { status: 400 },
    );

  await env.DB.prepare(
    `INSERT INTO doctor_directory_overrides (
       doctor_id, name, degree, department, hours, visible, updated_by, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(doctor_id) DO UPDATE SET
       name = excluded.name,
       degree = excluded.degree,
       department = excluded.department,
       hours = excluded.hours,
       visible = excluded.visible,
       updated_by = excluded.updated_by,
       updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(doctorId, name || null, degree || null, department || null, hours || null, visible ? 1 : 0, admin.username)
    .run();
  return Response.json({ ok: true, id: doctorId, visible });
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin)
    return Response.json({ error: "Administrator sign-in required." }, { status: 403 });
  const doctorId = clean(new URL(request.url).searchParams.get("id"), 60);
  if (!/^[a-z][a-z0-9-]{2,59}$/.test(doctorId))
    return Response.json({ error: "A valid doctor profile ID is required." }, { status: 400 });
  await env.DB.prepare(
    `INSERT INTO doctor_directory_overrides (doctor_id, visible, updated_by, updated_at)
     VALUES (?, 0, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(doctor_id) DO UPDATE SET
       visible = 0, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(doctorId, admin.username)
    .run();
  return Response.json({ ok: true, id: doctorId, visible: false });
}
