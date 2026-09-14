import { env } from "cloudflare:workers";
import { getAppSession } from "../../../../lib/session";
import { getD1File } from "../../../../lib/d1-file-storage";

type ApplicationRow = {
  id: number;
  username: string;
  full_name: string;
  medical_system: string;
  degree: string;
  council_registration: string;
  phone: string;
  department: string;
  university: string;
  state_council: string;
  experience_years: number;
  council_file_name: string;
  council_content_type: string;
  council_object_key: string;
  degree_file_name: string;
  degree_content_type: string;
  degree_object_key: string;
  identity_file_name: string;
  identity_content_type: string;
  identity_object_key: string;
  status: string;
  admin_note: string;
  reviewed_at: string | null;
  created_at: string;
};

async function requireAdmin(request: Request) {
  const session = await getAppSession(request);
  return session?.role === "admin" ? session : null;
}

export async function GET(request: Request) {
  if (!(await requireAdmin(request)))
    return Response.json({ error: "Administrator sign-in required." }, { status: 403 });

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  const documentKind = url.searchParams.get("document");
  if (Number.isInteger(id) && id > 0 && documentKind) {
    if (!new Set(["council", "degree", "identity"]).has(documentKind))
      return Response.json({ error: "Unknown credential document." }, { status: 400 });
    const row = await env.DB.prepare(
      `SELECT council_file_name, council_content_type, council_object_key,
              degree_file_name, degree_content_type, degree_object_key,
              identity_file_name, identity_content_type, identity_object_key
       FROM doctor_applications WHERE id = ?`,
    )
      .bind(id)
      .first<ApplicationRow>();
    if (!row)
      return Response.json({ error: "Doctor application not found." }, { status: 404 });
    const fileName = row[`${documentKind}_file_name` as keyof ApplicationRow];
    const contentType = row[`${documentKind}_content_type` as keyof ApplicationRow];
    const objectKey = row[`${documentKind}_object_key` as keyof ApplicationRow];
    if (typeof fileName !== "string" || typeof contentType !== "string" || typeof objectKey !== "string")
      return Response.json({ error: "Credential file is unavailable." }, { status: 404 });
    const object = await getD1File(objectKey);
    if (!object)
      return Response.json({ error: "Credential file is unavailable." }, { status: 404 });
    return new Response(object.bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `inline; filename="${fileName.replace(/[\r\n"\\]/g, "_")}"`,
      },
    });
  }

  const result = await env.DB.prepare(
    `SELECT id, username, full_name, medical_system, degree,
            council_registration, phone, department, university, state_council,
            experience_years, council_file_name, degree_file_name,
            identity_file_name, status, admin_note, reviewed_at, created_at
     FROM doctor_applications
     ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
              created_at DESC`,
  ).all();
  return Response.json({ applications: result.results });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin)
    return Response.json({ error: "Administrator sign-in required." }, { status: 403 });
  const payload = (await request.json()) as {
    id?: number;
    status?: string;
    adminNote?: string;
  };
  const id = Number(payload.id);
  const status = String(payload.status ?? "");
  const adminNote = String(payload.adminNote ?? "").trim().slice(0, 2000);
  if (!Number.isInteger(id) || id < 1 || !["pending", "approved", "rejected"].includes(status))
    return Response.json({ error: "Choose a valid application decision." }, { status: 400 });

  const application = await env.DB.prepare(
    `SELECT id, username, full_name, degree, department
     FROM doctor_applications WHERE id = ?`,
  )
    .bind(id)
    .first<Pick<ApplicationRow, "id" | "username" | "full_name" | "degree" | "department">>();
  if (!application)
    return Response.json({ error: "Doctor application not found." }, { status: 404 });

  const directoryName = /^dr\.?\s/i.test(application.full_name)
    ? application.full_name
    : `Dr. ${application.full_name}`;
  const statements = [
    env.DB.prepare(
      `UPDATE doctor_applications
       SET status = ?, admin_note = ?, reviewed_at = CASE WHEN ? = 'pending' THEN NULL ELSE CURRENT_TIMESTAMP END
       WHERE id = ?`,
    ).bind(status, adminNote, status, id),
    env.DB.prepare("UPDATE user_profiles SET active = ? WHERE username = ? AND role = 'doctor'")
      .bind(status === "approved" ? 1 : 0, application.username),
  ];
  if (status === "approved")
    statements.push(
      env.DB.prepare(
        `INSERT INTO doctor_directory_overrides (
          doctor_id, name, degree, department, hours, visible, updated_by, updated_at
        ) VALUES (?, ?, ?, ?, 'By appointment · Mon-Sat', 1, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(doctor_id) DO UPDATE SET
          name = excluded.name, degree = excluded.degree,
          department = excluded.department, hours = excluded.hours,
          visible = 1, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`,
      ).bind(
        `managed-${application.username}`,
        directoryName,
        application.degree,
        application.department,
        admin.username,
      ),
    );
  else
    statements.push(
      env.DB.prepare(
        `UPDATE doctor_directory_overrides
         SET visible = 0, updated_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE doctor_id = ?`,
      ).bind(admin.username, `managed-${application.username}`),
    );
  await env.DB.batch(statements);
  return Response.json({ ok: true, status, username: application.username });
}
