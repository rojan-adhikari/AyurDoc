import { env } from "cloudflare:workers";

export type AppRole = "patient" | "doctor" | "admin";

export type AppSession = {
  token: string;
  username: string;
  role: AppRole;
};

export const SESSION_COOKIE = "medikiosk_session";

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) return decodeURIComponent(valueParts.join("="));
  }
  return null;
}

export function readSessionToken(request: Request) {
  return readCookie(request, SESSION_COOKIE);
}

export async function getAppSession(
  request: Request,
): Promise<AppSession | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token || !env.DB) return null;

  const row = await env.DB.prepare(
    `SELECT token, username, role
     FROM sessions
     WHERE token = ? AND expires_at > CURRENT_TIMESTAMP`,
  )
    .bind(token)
    .first<{ token: string; username: string; role: string }>();

  if (
    !row ||
    (row.role !== "patient" && row.role !== "doctor" && row.role !== "admin")
  )
    return null;
  return { token: row.token, username: row.username, role: row.role as AppRole };
}

export function sessionCookie(token: string) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`;
}

export function expiredSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}
