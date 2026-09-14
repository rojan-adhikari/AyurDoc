import { env } from "cloudflare:workers";
import { hashPassword } from "../../../../lib/password";
import {
  isValidGmailAddress,
  isStrongPassword,
  isValidUsername,
} from "../../../../lib/validation";
import { RESERVED_USERNAMES } from "../../../../lib/demo-accounts";
import {
  deleteD1File,
  MAX_D1_FILE_BYTES,
  putD1File,
} from "../../../../lib/d1-file-storage";

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

function extensionFor(contentType: string) {
  if (contentType === "application/pdf") return "pdf";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid registration form." }, { status: 400 });
  }

  const challengeId = String(form.get("challengeId") ?? "");
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const displayName = String(form.get("displayName") ?? "").trim();
  const idType = String(form.get("idType") ?? "");
  const idFile = form.get("governmentId");

  const challenge = await env.DB.prepare(
    `SELECT email, verified_at, expires_at FROM otp_challenges WHERE id = ?`,
  )
    .bind(challengeId)
    .first<{ email: string; verified_at: string | null; expires_at: string }>();
  if (
    !challenge?.verified_at ||
    challenge.expires_at <= new Date().toISOString() ||
    !isValidGmailAddress(challenge.email)
  )
    return Response.json(
      { error: "Verify your Gmail address again before registration." },
      { status: 400 },
    );
  if (!isValidUsername(username))
    return Response.json(
      { error: "Username must start with a letter and use 3–24 letters, numbers, dots, dashes or underscores." },
      { status: 400 },
    );
  if (!isStrongPassword(password))
    return Response.json(
      { error: "Use at least 8 characters with both a letter and a number." },
      { status: 400 },
    );
  if (displayName.length < 2 || displayName.length > 120 || !ID_TYPES.has(idType))
    return Response.json(
      { error: "Enter your name and choose the government ID type." },
      { status: 400 },
    );
  if (
    !(idFile instanceof File) ||
    idFile.size < 100 ||
    idFile.size > MAX_D1_FILE_BYTES ||
    !FILE_TYPES.has(idFile.type)
  )
    return Response.json(
      { error: "Upload a clear PDF, JPG, PNG or WebP government ID under 1.5 MB." },
      { status: 400 },
    );

  const existing = await env.DB.prepare(
    "SELECT username FROM user_profiles WHERE username = ? OR email = ?",
  )
    .bind(username, challenge.email)
    .first();
  if (RESERVED_USERNAMES.has(username) || existing)
    return Response.json(
      { error: "That username or Gmail address is already registered." },
      { status: 409 },
    );

  const objectKey = `government-ids/${username}/${crypto.randomUUID()}.${extensionFor(idFile.type)}`;
  try {
    const passwordRecord = await hashPassword(password);
    await putD1File({
      objectKey,
      ownerUsername: username,
      category: "government-id",
      fileName: idFile.name,
      contentType: idFile.type,
      bytes: await idFile.arrayBuffer(),
    });
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO user_profiles (
          username, role, display_name, phone, email, password_hash, password_salt,
          email_verified_at, active, created_by
        ) VALUES (?, 'patient', ?, '', ?, ?, ?, CURRENT_TIMESTAMP, 1, 'self-registration-auto')`,
      ).bind(
        username,
        displayName,
        challenge.email,
        passwordRecord.hash,
        passwordRecord.salt,
      ),
      env.DB.prepare(
        `INSERT INTO government_ids (
          username, id_type, file_name, content_type, size_bytes, object_key
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(
        username,
        idType,
        idFile.name.slice(0, 180),
        idFile.type,
        idFile.size,
        objectKey,
      ),
      env.DB.prepare(
        `INSERT OR IGNORE INTO patient_abha_profiles (
          username, abha_number, abha_address, verification_status,
          consent_granted
        ) VALUES (?, '', '', 'not-linked', 0)`,
      ).bind(username),
      env.DB.prepare("UPDATE otp_challenges SET expires_at = datetime('now', '+5 minutes') WHERE id = ?").bind(challengeId),
    ]);

    return Response.json(
      {
        user: { username, role: "patient" },
        idStatus: "pending-review",
        pendingApproval: false,
        accessActive: true,
      },
      { status: 201 },
    );
  } catch (error) {
    await deleteD1File(objectKey);
    console.error("Registration failed", error);
    return Response.json(
      { error: "Registration could not be completed. Please try again." },
      { status: 500 },
    );
  }
}
