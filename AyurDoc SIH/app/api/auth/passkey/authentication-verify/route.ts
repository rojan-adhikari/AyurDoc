import { env } from "cloudflare:workers";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { demoAccountFor } from "../../../../../lib/demo-accounts";
import { sessionCookie, type AppRole } from "../../../../../lib/session";

type Challenge = { challenge: string; rp_id: string; expected_origin: string; expires_at: string };
type StoredCredential = {
  credential_id: string;
  username: string;
  public_key: string;
  counter: number;
  transports: string;
};

export async function POST(request: Request) {
  let payload: { challengeId?: string; response?: AuthenticationResponseJSON };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid biometric login response." }, { status: 400 });
  }
  if (!payload.challengeId || !payload.response)
    return Response.json({ error: "The biometric login response is incomplete." }, { status: 400 });

  const [saved, stored] = await Promise.all([
    env.DB.prepare(
      `SELECT challenge, rp_id, expected_origin, expires_at FROM passkey_challenges
       WHERE id = ? AND purpose = 'authentication'`,
    ).bind(payload.challengeId).first<Challenge>(),
    env.DB.prepare(
      `SELECT credential_id, username, public_key, counter, transports
       FROM passkey_credentials WHERE credential_id = ?`,
    ).bind(payload.response.id).first<StoredCredential>(),
  ]);
  if (!saved || saved.expires_at <= new Date().toISOString())
    return Response.json({ error: "This login request expired. Tap the face icon and try again." }, { status: 400 });
  if (!stored)
    return Response.json({ error: "This device is not registered with AyurDoc." }, { status: 401 });

  try {
    const verification = await verifyAuthenticationResponse({
      response: payload.response,
      expectedChallenge: saved.challenge,
      expectedOrigin: saved.expected_origin,
      expectedRPID: saved.rp_id,
      credential: {
        id: stored.credential_id,
        publicKey: isoBase64URL.toBuffer(stored.public_key),
        counter: stored.counter,
        transports: JSON.parse(stored.transports || "[]"),
      },
      requireUserVerification: true,
    });
    if (!verification.verified)
      return Response.json({ error: "Your identity could not be verified." }, { status: 401 });

    const demo = demoAccountFor(stored.username);
    let role: AppRole | null = demo?.role === "patient" || demo?.role === "doctor" ? demo.role : null;
    if (!role) {
      const profile = await env.DB.prepare(
        `SELECT role, active FROM user_profiles WHERE username = ?`,
      ).bind(stored.username).first<{ role: string; active: number }>();
      if (profile && !profile.active)
        return Response.json({ error: "Your account is still awaiting administrator approval." }, { status: 403 });
      if (profile?.active && (profile.role === "patient" || profile.role === "doctor")) role = profile.role;
    }
    if (!role) return Response.json({ error: "This AyurDoc account is unavailable." }, { status: 403 });

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE passkey_credentials SET counter = ?, last_used_at = CURRENT_TIMESTAMP WHERE credential_id = ?`,
      ).bind(verification.authenticationInfo.newCounter, stored.credential_id),
      env.DB.prepare(`DELETE FROM passkey_challenges WHERE id = ?`).bind(payload.challengeId),
      env.DB.prepare(
        `INSERT INTO sessions (token, username, role, expires_at) VALUES (?, ?, ?, ?)`,
      ).bind(token, stored.username, role, expiresAt),
    ]);
    return Response.json(
      { user: { username: stored.username, role } },
      { headers: { "Set-Cookie": sessionCookie(token) } },
    );
  } catch (error) {
    console.error("Passkey authentication verification failed", error);
    return Response.json({ error: "Biometric login was cancelled or could not be verified." }, { status: 401 });
  }
}
