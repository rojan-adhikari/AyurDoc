import { env } from "cloudflare:workers";

export async function GET() {
  const result = await env.DB.prepare(
    `SELECT doctor_id, name, degree, department, hours, visible, updated_at
     FROM doctor_directory_overrides
     ORDER BY updated_at DESC`,
  ).all();
  return Response.json({ overrides: result.results });
}
