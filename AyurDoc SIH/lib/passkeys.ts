import { env } from "cloudflare:workers";
import { getAppSession } from "./session";

export const PASSKEY_RP_NAME = "AyurDoc";

export function passkeyRequestContext(request: Request) {
  const url = new URL(request.url);
  return { rpID: url.hostname, expectedOrigin: url.origin };
}

export function passkeyExpiry() {
  return new Date(Date.now() + 5 * 60 * 1000).toISOString();
}

export async function canRegisterPasskey(
  request: Request,
  username: string,
  registrationChallengeId = "",
) {
  const session = await getAppSession(request);
  if (session?.username === username && session.role !== "admin") return true;

  if (!registrationChallengeId) return false;
  const otp = await env.DB.prepare(
    `SELECT o.verified_at, o.expires_at
     FROM otp_challenges o
     JOIN user_profiles u ON u.email = o.email
     WHERE o.id = ? AND u.username = ?`,
  )
    .bind(registrationChallengeId, username)
    .first<{ verified_at: string | null; expires_at: string }>();
  if (!otp?.verified_at || otp.expires_at <= new Date().toISOString()) return false;

  return true;
}

export async function savePasskeyChallenge(input: {
  username: string;
  purpose: "registration" | "authentication";
  challenge: string;
  rpID: string;
  expectedOrigin: string;
}) {
  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM passkey_challenges WHERE expires_at <= CURRENT_TIMESTAMP`),
    env.DB.prepare(
      `INSERT INTO passkey_challenges
       (id, username, purpose, challenge, rp_id, expected_origin, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      input.username,
      input.purpose,
      input.challenge,
      input.rpID,
      input.expectedOrigin,
      passkeyExpiry(),
    ),
  ]);
  return id;
}
