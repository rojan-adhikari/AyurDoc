import { env } from "cloudflare:workers";
import { getAppSession } from "../../../../lib/session";
import { getD1File } from "../../../../lib/d1-file-storage";

export async function GET(request: Request) {
  const session = await getAppSession(request);
  if (!session || session.role !== "admin")
    return Response.json({ error: "Administrator sign-in required." }, { status: 403 });
  const username = new URL(request.url).searchParams.get("username")?.trim().toLowerCase() ?? "";
  if (!username)
    return Response.json({ error: "Patient username required." }, { status: 400 });
  const row = await env.DB.prepare(
    `SELECT file_name, content_type, object_key FROM government_ids WHERE username = ?`,
  ).bind(username).first<{ file_name: string; content_type: string; object_key: string }>();
  if (!row) return Response.json({ error: "Government ID not found." }, { status: 404 });
  const object = await getD1File(row.object_key);
  if (!object) return Response.json({ error: "Government ID file unavailable." }, { status: 404 });
  const safeName = row.file_name.replace(/[\r\n"\\]/g, "_");
  return new Response(object.bytes, {
    headers: {
      "Content-Type": row.content_type,
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function PATCH(request: Request) {
  const session = await getAppSession(request);
  if (!session || session.role !== "admin")
    return Response.json({ error: "Administrator sign-in required." }, { status: 403 });
  const payload = (await request.json()) as { username?: string; status?: string };
  const username = String(payload.username ?? "").trim().toLowerCase();
  const status = String(payload.status ?? "");
  if (!username || !["pending", "verified", "rejected"].includes(status))
    return Response.json({ error: "Choose a valid identity review status." }, { status: 400 });
  const [result] = await env.DB.batch([
    env.DB.prepare("UPDATE government_ids SET review_status = ? WHERE username = ?")
      .bind(status, username),
    env.DB.prepare(
      `UPDATE user_profiles SET active = ?
       WHERE username = ? AND role = 'patient' AND created_by = 'self-registration-pending'`,
    ).bind(status === "verified" ? 1 : 0, username),
  ]);
  if (!result.meta.changes)
    return Response.json({ error: "Government ID not found." }, { status: 404 });
  const account = await env.DB.prepare(
    "SELECT active FROM user_profiles WHERE username = ? AND role = 'patient'",
  ).bind(username).first<{ active: number }>();
  return Response.json({ ok: true, status, accessActive: account?.active === 1 });
}
