import { env } from "cloudflare:workers";
import { sessionCookie, type AppRole } from "../../../../lib/session";
import { verifyPassword } from "../../../../lib/password";
import { demoAccountFor } from "../../../../lib/demo-accounts";

type StoredAccount = {
  username: string;
  role: string;
  password_hash: string;
  password_salt: string;
  active: number;
};

export async function POST(request: Request) {
  const payload = (await request.json()) as { username?: string; password?: string };
  const username = payload.username?.trim().toLowerCase() ?? "";
  const demoAccount = demoAccountFor(username);
  let role: AppRole | null = null;

  if (demoAccount && payload.password === demoAccount.password) {
    role = demoAccount.role;
  } else if (!demoAccount && payload.password) {
    const stored = await env.DB.prepare(
      `SELECT username, role, password_hash, password_salt, active
       FROM user_profiles WHERE username = ?`,
    )
      .bind(username)
      .first<StoredAccount>();
    if (stored && !stored.active && await verifyPassword(payload.password, stored.password_hash, stored.password_salt)) {
      return Response.json(
        { error: "Registration is awaiting administrator verification. Sign in after your government ID or medical credentials are approved." },
        { status: 403 },
      );
    }
    if (
      stored?.active &&
      (stored.role === "patient" || stored.role === "doctor") &&
      (await verifyPassword(
        payload.password,
        stored.password_hash,
        stored.password_salt,
      ))
    )
      role = stored.role;
  }

  if (!role) {
    return Response.json({ error: "Incorrect username or password." }, { status: 401 });
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO sessions (token, username, role, expires_at) VALUES (?, ?, ?, ?)"
  )
    .bind(token, username, role, expiresAt)
    .run();

  return Response.json(
    { user: { username, role } },
    { headers: { "Set-Cookie": sessionCookie(token) } }
  );
}
