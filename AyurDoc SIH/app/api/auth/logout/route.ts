import { env } from "cloudflare:workers";
import {
  expiredSessionCookie,
  readSessionToken,
} from "../../../../lib/session";

export async function POST(request: Request) {
  const token = readSessionToken(request);
  if (token) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?")
      .bind(token)
      .run();
  }
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": expiredSessionCookie() } },
  );
}
