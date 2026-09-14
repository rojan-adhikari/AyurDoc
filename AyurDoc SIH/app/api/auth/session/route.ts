import { getAppSession } from "../../../../lib/session";

export async function GET(request: Request) {
  const session = await getAppSession(request);
  if (!session) return Response.json({ user: null }, { status: 401 });
  return Response.json({ user: { username: session.username, role: session.role } });
}
