import { env } from "cloudflare:workers";
import { hashPassword } from "../../../../lib/password";
import { getAppSession } from "../../../../lib/session";
import {
  gmailValidationMessage,
  isValidGmailAddress,
  isStrongPassword,
  isValidPhoneNumber,
  isValidUsername,
  normalizeEmail,
  normalizePhone,
  phoneValidationMessage,
} from "../../../../lib/validation";
import { DEMO_ACCOUNTS, RESERVED_USERNAMES } from "../../../../lib/demo-accounts";
import { deleteD1File } from "../../../../lib/d1-file-storage";

async function requireAdmin(request: Request) {
  const session = await getAppSession(request);
  return session?.role === "admin" ? session : null;
}

export async function GET(request: Request) {
  if (!(await requireAdmin(request)))
    return Response.json({ error: "Administrator sign-in required." }, { status: 403 });
  const [result, identityResult, abhaResult] = await Promise.all([env.DB.prepare(
    `SELECT u.username, u.role, u.display_name, u.phone, u.email,
            u.phone_verified_at, u.email_verified_at,
            u.active, u.created_by, u.created_at,
            g.id_type, g.review_status, a.abha_number, a.abha_address,
            a.verification_status AS abha_status,
            CASE WHEN a.abha_number <> '' THEN 1 ELSE 0 END AS abha_linked
     FROM user_profiles u
     LEFT JOIN government_ids g ON g.username = u.username
     LEFT JOIN patient_abha_profiles a ON a.username = u.username
     ORDER BY u.role, u.created_at DESC`,
  ).all(), env.DB.prepare(
    "SELECT username, id_type, review_status FROM government_ids",
  ).all<{ username: string; id_type: string; review_status: string }>(), env.DB.prepare(
    "SELECT username, abha_number, abha_address, verification_status, CASE WHEN abha_number <> '' THEN 1 ELSE 0 END AS abha_linked FROM patient_abha_profiles",
  ).all<{ username: string; abha_number: string; abha_address: string; verification_status: string; abha_linked: number }>()]);
  let passkeyRows: Array<{ username: string; passkey_count: number }> = [];
  try {
    const passkeyResult = await env.DB.prepare(
      "SELECT username, COUNT(*) AS passkey_count FROM passkey_credentials GROUP BY username",
    ).all<{ username: string; passkey_count: number }>();
    passkeyRows = passkeyResult.results;
  } catch {
    // Older deployments can still load the admin portal before the passkey migration runs.
  }
  const passkeys = new Map(passkeyRows.map((item) => [item.username, Number(item.passkey_count)]));
  const identities = new Map(identityResult.results.map((item) => [item.username, item]));
  const abhaProfiles = new Map(abhaResult.results.map((item) => [item.username, item]));
  const protectedAccounts = DEMO_ACCOUNTS
    .map((account) => {
      const identity = identities.get(account.username);
      const abha = abhaProfiles.get(account.username);
      return {
        username: account.username,
        role: account.role,
        display_name: account.displayName,
        phone: "",
        email: "",
        active: 1,
        created_by: "protected-demo",
        managed: false,
        id_type: identity?.id_type ?? null,
        review_status: identity?.review_status ?? null,
        abha_status: abha?.verification_status ?? "not-linked",
        abha_linked: abha?.abha_linked ?? 0,
        abha_number: abha?.abha_number ?? "",
        abha_address: abha?.abha_address ?? "",
        passkey_count: passkeys.get(account.username) ?? 0,
      };
    });
  return Response.json({
    users: [
      ...protectedAccounts,
      ...(result.results as Record<string, unknown>[]).map((user) => ({
        ...user,
        managed: true,
        passkey_count: passkeys.get(String(user.username)) ?? 0,
      })),
    ],
  });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin)
    return Response.json({ error: "Administrator sign-in required." }, { status: 403 });
  const payload = (await request.json()) as {
    username?: string;
    password?: string;
    role?: string;
    displayName?: string;
    phone?: string;
    email?: string;
    degree?: string;
    department?: string;
    hours?: string;
  };
  const username = String(payload.username ?? "").trim().toLowerCase();
  const password = String(payload.password ?? "");
  const role = String(payload.role ?? "");
  const displayName = String(payload.displayName ?? "").trim();
  const phone = normalizePhone(String(payload.phone ?? ""));
  const email = normalizeEmail(String(payload.email ?? ""));
  const degree = String(payload.degree ?? "").replace(/\s+/g, " ").trim().slice(0, 220);
  const department = String(payload.department ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
  const hours = String(payload.hours ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!isValidUsername(username) || RESERVED_USERNAMES.has(username))
    return Response.json(
      { error: "Use a unique 3–24 character username beginning with a letter." },
      { status: 400 },
    );
  if (!isStrongPassword(password))
    return Response.json(
      { error: "Temporary password needs 8 characters with a letter and number." },
      { status: 400 },
    );
  if (!new Set(["patient", "doctor"]).has(role))
    return Response.json({ error: "Choose Patient or Doctor." }, { status: 400 });
  if (displayName.length < 2 || displayName.length > 120)
    return Response.json({ error: "Enter the person’s full name." }, { status: 400 });
  if (!isValidGmailAddress(email))
    return Response.json({ error: gmailValidationMessage(email) }, { status: 400 });
  if (phone && !isValidPhoneNumber(phone))
    return Response.json({ error: phoneValidationMessage(phone) }, { status: 400 });
  if (role === "doctor" && (!degree || !department || !hours))
    return Response.json(
      { error: "Doctor qualification, department and clinic hours are required." },
      { status: 400 },
    );

  const existing = await env.DB.prepare(
    `SELECT username FROM user_profiles
     WHERE username = ? OR email = ? OR (phone <> '' AND phone = ?)`,
  )
    .bind(username, email, phone)
    .first();
  if (existing)
    return Response.json(
      { error: "That username, Gmail address or phone number is already in use." },
      { status: 409 },
    );
  const passwordRecord = await hashPassword(password);
  const statements = [env.DB.prepare(
    `INSERT INTO user_profiles (
      username, role, display_name, phone, email, password_hash, password_salt,
      email_verified_at, active, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1, ?)`,
  )
    .bind(
      username,
      role,
      displayName,
      phone,
      email,
      passwordRecord.hash,
      passwordRecord.salt,
      admin.username,
    )];
  if (role === "doctor")
    statements.push(
      env.DB.prepare(
        `INSERT INTO doctor_directory_overrides (
           doctor_id, name, degree, department, hours, visible, updated_by
         ) VALUES (?, ?, ?, ?, ?, 1, ?)`,
      ).bind(
        `managed-${username}`,
        displayName,
        degree,
        department,
        hours,
        admin.username,
      ),
    );
  else
    statements.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO patient_abha_profiles (
          username, abha_number, abha_address, verification_status,
          consent_granted
        ) VALUES (?, '', '', 'not-linked', 0)`,
      ).bind(username),
    );
  await env.DB.batch(statements);
  return Response.json({ ok: true, username }, { status: 201 });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin)
    return Response.json({ error: "Administrator sign-in required." }, { status: 403 });
  const payload = (await request.json()) as {
    username?: string;
    action?: string;
    displayName?: string;
    phone?: string;
    email?: string;
    active?: boolean;
    newPassword?: string;
  };
  const username = String(payload.username ?? "").trim().toLowerCase();
  if (payload.action === "clear-passkeys") {
    if (!username)
      return Response.json({ error: "Choose an account." }, { status: 400 });
    const result = await env.DB.prepare(
      "DELETE FROM passkey_credentials WHERE username = ?",
    ).bind(username).run();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM passkey_challenges WHERE username = ?").bind(username),
      env.DB.prepare(
        `INSERT INTO audit_events
         (actor_username, actor_role, action, resource_type, resource_id, detail_json)
         VALUES (?, 'admin', 'admin.passkeys-cleared', 'UserProfile', ?, ?)`,
      ).bind(admin.username, username, JSON.stringify({ removed: Number(result.meta.changes ?? 0) })),
    ]);
    return Response.json({ ok: true, removed: Number(result.meta.changes ?? 0) });
  }
  const displayName = String(payload.displayName ?? "").trim().slice(0, 120);
  const phone = normalizePhone(String(payload.phone ?? ""));
  const email = normalizeEmail(String(payload.email ?? ""));
  const newPassword = String(payload.newPassword ?? "");
  if (!username || RESERVED_USERNAMES.has(username))
    return Response.json({ error: "Protected demo accounts cannot be changed." }, { status: 400 });
  if (displayName.length < 2 || !isValidGmailAddress(email))
    return Response.json({ error: "Enter a valid full name and Gmail address." }, { status: 400 });
  if (phone && !isValidPhoneNumber(phone))
    return Response.json({ error: phoneValidationMessage(phone) }, { status: 400 });
  if (newPassword && !isStrongPassword(newPassword))
    return Response.json(
      { error: "New password needs 8 characters with a letter and number." },
      { status: 400 },
    );
  const existingContact = await env.DB.prepare(
    `SELECT username FROM user_profiles
     WHERE username != ? AND (email = ? OR (phone <> '' AND phone = ?))`,
  )
    .bind(username, email, phone)
    .first();
  if (existingContact)
    return Response.json({ error: "That Gmail address or phone number is already in use." }, { status: 409 });

  const passwordRecord = newPassword ? await hashPassword(newPassword) : null;
  const result = passwordRecord
    ? await env.DB.prepare(
        `UPDATE user_profiles SET display_name = ?, phone = ?, email = ?, active = ?,
         password_hash = ?, password_salt = ? WHERE username = ?`,
      )
        .bind(
          displayName,
          phone,
          email,
          payload.active === false ? 0 : 1,
          passwordRecord.hash,
          passwordRecord.salt,
          username,
        )
        .run()
    : await env.DB.prepare(
        "UPDATE user_profiles SET display_name = ?, phone = ?, email = ?, active = ? WHERE username = ?",
      )
        .bind(displayName, phone, email, payload.active === false ? 0 : 1, username)
        .run();
  if (!result.meta.changes)
    return Response.json({ error: "Profile not found." }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin(request)))
    return Response.json({ error: "Administrator sign-in required." }, { status: 403 });
  const username = String(new URL(request.url).searchParams.get("username") ?? "")
    .trim()
    .toLowerCase();
  if (!username || RESERVED_USERNAMES.has(username))
    return Response.json(
      { error: "Protected demo accounts cannot be removed." },
      { status: 400 },
    );
  const identity = await env.DB.prepare(
    "SELECT object_key FROM government_ids WHERE username = ?",
  )
    .bind(username)
    .first<{ object_key: string }>();
  const profile = await env.DB.prepare(
    "SELECT username FROM user_profiles WHERE username = ?",
  )
    .bind(username)
    .first();
  if (!profile)
    return Response.json({ error: "Profile not found." }, { status: 404 });

  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE username = ?").bind(username),
    env.DB.prepare("DELETE FROM passkey_challenges WHERE username = ?").bind(username),
    env.DB.prepare("DELETE FROM passkey_credentials WHERE username = ?").bind(username),
    env.DB.prepare("DELETE FROM government_ids WHERE username = ?").bind(username),
    env.DB.prepare("DELETE FROM doctor_directory_overrides WHERE doctor_id = ?").bind(
      `managed-${username}`,
    ),
    env.DB.prepare("DELETE FROM user_profiles WHERE username = ?").bind(username),
  ]);
  if (identity?.object_key) await deleteD1File(identity.object_key);
  return Response.json({ ok: true });
}
