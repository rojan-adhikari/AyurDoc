import { env } from "cloudflare:workers";
import { hashPassword } from "../../../../lib/password";
import { RESERVED_USERNAMES } from "../../../../lib/demo-accounts";
import { DEPARTMENTS } from "../../../../lib/doctor-directory";
import {
  isStrongPassword,
  isValidPhoneNumber,
  isValidUsername,
  normalizePhone,
} from "../../../../lib/validation";
import {
  deleteD1File,
  MAX_D1_FILE_BYTES,
  putD1File,
} from "../../../../lib/d1-file-storage";

const MEDICAL_SYSTEMS = new Set([
  "Ayurveda",
  "Ayurveda with modern diagnostic support",
  "Integrative Ayurveda",
]);
const FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function validCredential(value: FormDataEntryValue | null): value is File {
  return (
    value instanceof File &&
    value.size >= 100 &&
    value.size <= MAX_D1_FILE_BYTES &&
    FILE_TYPES.has(value.type)
  );
}

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
    return Response.json({ error: "Invalid doctor application form." }, { status: 400 });
  }

  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const fullName = String(form.get("fullName") ?? "").replace(/\s+/g, " ").trim();
  const medicalSystem = String(form.get("medicalSystem") ?? "").trim();
  const degree = String(form.get("degree") ?? "").replace(/\s+/g, " ").trim();
  const councilRegistration = String(form.get("councilRegistration") ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  const phone = normalizePhone(String(form.get("phone") ?? ""));
  const department = String(form.get("department") ?? "").trim();
  const university = String(form.get("university") ?? "").replace(/\s+/g, " ").trim();
  const stateCouncil = String(form.get("stateCouncil") ?? "").replace(/\s+/g, " ").trim();
  const experienceYears = Number(form.get("experienceYears"));
  const councilFile = form.get("councilFile");
  const degreeFile = form.get("degreeFile");
  const identityFile = form.get("identityFile");

  if (!isValidUsername(username) || RESERVED_USERNAMES.has(username))
    return Response.json(
      { error: "Choose a unique username with 3–24 letters, numbers, dots, dashes or underscores." },
      { status: 400 },
    );
  if (!isStrongPassword(password))
    return Response.json(
      { error: "Password needs at least 8 characters with a letter and a number." },
      { status: 400 },
    );
  if (
    fullName.length < 3 ||
    fullName.length > 120 ||
    !MEDICAL_SYSTEMS.has(medicalSystem) ||
    degree.length < 3 ||
    degree.length > 220 ||
    councilRegistration.length < 4 ||
    councilRegistration.length > 80 ||
    !isValidPhoneNumber(phone) ||
    !DEPARTMENTS.includes(department as (typeof DEPARTMENTS)[number]) ||
    university.length < 3 ||
    university.length > 180 ||
    stateCouncil.length < 3 ||
    stateCouncil.length > 160 ||
    !Number.isInteger(experienceYears) ||
    experienceYears < 0 ||
    experienceYears > 70
  )
    return Response.json(
      { error: "Complete every professional detail with valid information." },
      { status: 400 },
    );
  if (
    !validCredential(councilFile) ||
    !validCredential(degreeFile) ||
    !validCredential(identityFile)
  )
    return Response.json(
      { error: "Upload all three credentials as clear PDF, JPG, PNG or WebP files under 1.5 MB each." },
      { status: 400 },
    );

  const existing = await env.DB.prepare(
    `SELECT username FROM user_profiles WHERE username = ? OR (phone <> '' AND phone = ?)
     UNION ALL
     SELECT username FROM doctor_applications WHERE council_registration = ? LIMIT 1`,
  )
    .bind(username, phone, councilRegistration)
    .first();
  if (existing)
    return Response.json(
      { error: "That username, phone number or council registration is already registered." },
      { status: 409 },
    );

  const applicationFolder = `doctor-credentials/${username}/${crypto.randomUUID()}`;
  const credentials = [
    { kind: "council", file: councilFile },
    { kind: "degree", file: degreeFile },
    { kind: "identity", file: identityFile },
  ] as const;
  const keys = credentials.map(
    ({ kind, file }) => `${applicationFolder}/${kind}.${extensionFor(file.type)}`,
  );

  try {
    const passwordRecord = await hashPassword(password);
    await Promise.all(
      credentials.map(async ({ kind, file }, index) =>
        putD1File({
          objectKey: keys[index],
          ownerUsername: username,
          category: `doctor-${kind}`,
          fileName: file.name,
          contentType: file.type,
          bytes: await file.arrayBuffer(),
        }),
      ),
    );
    const result = await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO user_profiles (
          username, role, display_name, phone, email, password_hash, password_salt,
          active, created_by
        ) VALUES (?, 'doctor', ?, ?, '', ?, ?, 0, 'doctor-self-registration')`,
      ).bind(
        username,
        fullName,
        phone,
        passwordRecord.hash,
        passwordRecord.salt,
      ),
      env.DB.prepare(
        `INSERT INTO doctor_applications (
          username, full_name, medical_system, degree, council_registration,
          phone, department, university, state_council, experience_years,
          council_file_name, council_content_type, council_size_bytes, council_object_key,
          degree_file_name, degree_content_type, degree_size_bytes, degree_object_key,
          identity_file_name, identity_content_type, identity_size_bytes, identity_object_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        username,
        fullName,
        medicalSystem,
        degree,
        councilRegistration,
        phone,
        department,
        university,
        stateCouncil,
        experienceYears,
        councilFile.name.slice(0, 180),
        councilFile.type,
        councilFile.size,
        keys[0],
        degreeFile.name.slice(0, 180),
        degreeFile.type,
        degreeFile.size,
        keys[1],
        identityFile.name.slice(0, 180),
        identityFile.type,
        identityFile.size,
        keys[2],
      ),
    ]);
    return Response.json(
      {
        id: result[1].meta.last_row_id,
        username,
        status: "pending",
        message: "Application submitted for hospital credential verification.",
      },
      { status: 201 },
    );
  } catch (error) {
    await Promise.all(keys.map((key) => deleteD1File(key)));
    console.error("Doctor application failed", error);
    return Response.json(
      { error: "The doctor application could not be saved. Please try again." },
      { status: 500 },
    );
  }
}
