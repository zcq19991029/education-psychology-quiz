import { sql } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";

export async function GET() {
  const user = await getChatGPTUser();
  try {
    const db = getDb();
    await db.run(sql`select 1`);
    return Response.json({ ok: true, authenticated: Boolean(user), userId: user?.userId ?? null });
  } catch (error) {
    console.error("D1 health check failed", error);
    return Response.json({ ok: false, authenticated: Boolean(user), error: "D1 unavailable" }, { status: 503 });
  }
}
