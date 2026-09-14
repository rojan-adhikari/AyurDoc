import { env } from "cloudflare:workers";
import { getAppSession } from "../../../lib/session";
import {
  deleteD1File,
  MAX_D1_FILE_BYTES,
  putD1File,
} from "../../../lib/d1-file-storage";

const ID_TYPES = new Set([
  "Aadhaar",
  "PAN",
  "Voter ID",
  "Passport",
  "Driving licence",
  "Other government ID",
]);
const FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type IdentityRow = {
  id: number;
  id_type: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  object_key: string;
  review_status: string;
  uploaded_at: string;
};

function extensionFor(contentType: string) {
  if (contentType === "application/pdf") return "pdf";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

export async function GET(request: Request) {
  const session = await getAppSession(request);
  if (!session || session.role !== "patient")
    return Response.json({ error: "Patient sign-in required." }, { status: 403 });
  const identity = await env.DB.prepare(
    `SELECT id, id_type, file_name, content_type, size_bytes, review_status, uploaded_at
     FROM government_ids WHERE username = ?`,
  )
    .bind(session.username)
    .first<Omit<IdentityRow, "object_key">>();
  return Response.json({ identity: identity ?? null });
}

export async function POST(request: Request) {
  const session = await getAppSession(request);
  if (!session || session.role !== "patient")
    return Response.json({ error: "Patient sign-in required." }, { status: 403 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid identity form." }, { status: 400 });
  }
  const idType = String(form.get("idType") ?? "");
  const file = form.get("governmentId");
  if (
    !ID_TYPES.has(idType) ||
    !(file instanceof File) ||
    file.size < 100 ||
    file.size > MAX_D1_FILE_BYTES ||
    !FILE_TYPES.has(file.type)
  )
    return Response.json(
      { error: "Choose an ID type and upload a clear PDF, JPG, PNG or WebP under 1.5 MB." },
      { status: 400 },
    );

  const existing = await env.DB.prepare(
    "SELECT object_key FROM government_ids WHERE username = ?",
  )
    .bind(session.username)
    .first<{ object_key: string }>();
  const objectKey = `government-ids/${session.username}/${crypto.randomUUID()}.${extensionFor(file.type)}`;
  await putD1File({
    objectKey,
    ownerUsername: session.username,
    category: "government-id",
    fileName: file.name,
    contentType: file.type,
    bytes: await file.arrayBuffer(),
  });
  try {
    await env.DB.prepare(
      `INSERT INTO government_ids (
        username, id_type, file_name, content_type, size_bytes, object_key,
        review_status, uploaded_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
      ON CONFLICT(username) DO UPDATE SET
        id_type = excluded.id_type,
        file_name = excluded.file_name,
        content_type = excluded.content_type,
        size_bytes = excluded.size_bytes,
        object_key = excluded.object_key,
        review_status = 'pending',
        uploaded_at = CURRENT_TIMESTAMP`,
    )
      .bind(
        session.username,
        idType,
        file.name.slice(0, 180),
        file.type,
        file.size,
        objectKey,
      )
      .run();
    if (existing?.object_key) await deleteD1File(existing.object_key);
    return Response.json(
      { identity: { id_type: idType, file_name: file.name.slice(0, 180), review_status: "pending" } },
      { status: 201 },
    );
  } catch (error) {
    await deleteD1File(objectKey);
    console.error("Identity upload failed", error);
    return Response.json({ error: "Government ID could not be saved." }, { status: 500 });
  }
}
