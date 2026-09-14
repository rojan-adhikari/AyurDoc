import { env } from "cloudflare:workers";
import {
  gmailValidationMessage,
  isValidGmailAddress,
  normalizeEmail,
} from "../../../../lib/validation";

type EmailEnvironment = typeof env & {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
};

function createOtp() {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return String(100000 + (random[0] % 900000));
}

async function otpHash(challengeId: string, code: string, secret: string) {
  const bytes = new TextEncoder().encode(`${challengeId}:${code}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function hashesMatch(first: string, second: string) {
  if (first.length !== second.length) return false;
  let difference = 0;
  for (let index = 0; index < first.length; index += 1)
    difference |= first.charCodeAt(index) ^ second.charCodeAt(index);
  return difference === 0;
}

function maskedEmail(email: string) {
  const [local, domain] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"•".repeat(Math.max(3, Math.min(7, local.length - visible.length)))}@${domain}`;
}

export async function POST(request: Request) {
  const emailEnv = env as EmailEnvironment;
  const payload = (await request.json()) as {
    action?: "request" | "verify";
    email?: string;
    challengeId?: string;
    code?: string;
  };

  if (payload.action === "request") {
    const email = normalizeEmail(payload.email ?? "");
    if (!isValidGmailAddress(email))
      return Response.json(
        { error: gmailValidationMessage(email) },
        { status: 400 },
      );

    const existing = await env.DB.prepare(
      "SELECT username FROM user_profiles WHERE email = ? AND active = 1",
    )
      .bind(email)
      .first();
    if (existing)
      return Response.json(
        { error: "This Gmail address is already registered. Sign in instead." },
        { status: 409 },
      );

    if (!emailEnv.RESEND_API_KEY || !emailEnv.RESEND_FROM_EMAIL)
      return Response.json(
        {
          error:
            "Email verification is being configured. Existing patients can still sign in.",
          code: "EMAIL_NOT_CONFIGURED",
        },
        { status: 503 },
      );

    const recent = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM otp_challenges
       WHERE email = ? AND created_at >= datetime('now', '-10 minutes')`,
    )
      .bind(email)
      .first<{ count: number }>();
    if (Number(recent?.count ?? 0) >= 3)
      return Response.json(
        { error: "Too many OTP requests. Wait ten minutes and try again." },
        { status: 429 },
      );

    const challengeId = crypto.randomUUID();
    const code = createOtp();
    const codeHash = await otpHash(challengeId, code, emailEnv.RESEND_API_KEY);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await env.DB.prepare(
      `INSERT INTO otp_challenges (id, phone, email, code_hash, expires_at)
       VALUES (?, '', ?, ?, ?)`,
    )
      .bind(challengeId, email, codeHash, expiresAt)
      .run();

    const providerResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${emailEnv.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailEnv.RESEND_FROM_EMAIL,
        to: [email],
        subject: `${code} is your AyurDoc verification code`,
        text: `Your AyurDoc verification code is ${code}. It expires in 5 minutes. Do not share this code.`,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:28px;color:#17211d"><h1 style="font-size:24px;margin:0 0 12px">Verify your AyurDoc account</h1><p style="line-height:1.6">Enter this one-time code to continue:</p><div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#08795c;background:#edf9f5;border-radius:14px;padding:18px 20px;text-align:center">${code}</div><p style="line-height:1.6;color:#52615b">This code expires in 5 minutes. Do not share it with anyone.</p><p style="font-size:13px;color:#708078">Med Zone · AyurDoc</p></div>`,
      }),
    });
    const providerResult = (await providerResponse.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      error?: { message?: string };
    };
    if (!providerResponse.ok || !providerResult.id) {
      await env.DB.prepare("DELETE FROM otp_challenges WHERE id = ?")
        .bind(challengeId)
        .run();
      return Response.json(
        {
          error:
            providerResult.error?.message ||
            providerResult.message ||
            "The verification email could not be sent. Check the Gmail address and try again.",
        },
        { status: 502 },
      );
    }

    return Response.json({
      challengeId,
      expiresInSeconds: 300,
      delivery: "email",
      message: `OTP emailed to ${maskedEmail(email)}. Check Inbox and Spam.`,
    });
  }

  if (payload.action === "verify") {
    const challengeId = String(payload.challengeId ?? "");
    const code = String(payload.code ?? "").replace(/\D/g, "").slice(0, 6);
    const row = await env.DB.prepare(
      `SELECT id, email, code_hash, attempts, expires_at, verified_at
       FROM otp_challenges WHERE id = ?`,
    )
      .bind(challengeId)
      .first<{
        id: string;
        email: string;
        code_hash: string;
        attempts: number;
        expires_at: string;
        verified_at: string | null;
      }>();
    if (!row || row.verified_at || row.expires_at <= new Date().toISOString())
      return Response.json(
        { error: "This OTP has expired. Request a new code." },
        { status: 400 },
      );
    if (row.attempts >= 5)
      return Response.json(
        { error: "Too many attempts. Request a new OTP." },
        { status: 429 },
      );
    if (!emailEnv.RESEND_API_KEY)
      return Response.json(
        { error: "Email verification is temporarily unavailable." },
        { status: 503 },
      );

    const submittedHash = await otpHash(challengeId, code, emailEnv.RESEND_API_KEY);
    if (code.length !== 6 || !hashesMatch(row.code_hash, submittedHash)) {
      await env.DB.prepare(
        "UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ?",
      )
        .bind(challengeId)
        .run();
      return Response.json({ error: "Incorrect or expired OTP." }, { status: 400 });
    }
    await env.DB.prepare(
      "UPDATE otp_challenges SET verified_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
      .bind(challengeId)
      .run();
    return Response.json({ verified: true, email: row.email });
  }

  return Response.json({ error: "Invalid OTP action." }, { status: 400 });
}
