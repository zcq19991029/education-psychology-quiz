import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { questionBanks } from "../../../db/schema";

const SUBJECTS = new Set(["psychology", "education"]);
const MAX_QUESTIONS_BYTES = 8 * 1024 * 1024;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function parseSubject(value: string | null) {
  const subject = value?.trim() ?? "";
  return SUBJECTS.has(subject) ? subject : null;
}

function parseQuestions(value: unknown) {
  if (!Array.isArray(value)) throw new Error("questions must be an array");
  const encoded = JSON.stringify(value);
  if (new TextEncoder().encode(encoded).byteLength > MAX_QUESTIONS_BYTES) {
    throw new Error("题库超过 8 MB 限制");
  }
  return { value, encoded };
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return jsonError("需要先登录 ChatGPT 账号", 401);

  const subject = parseSubject(new URL(request.url).searchParams.get("subject"));
  if (!subject) return jsonError("subject 必须是 psychology 或 education", 400);

  try {
    const row = await getDb()
      .select({ questionsJson: questionBanks.questionsJson, updatedAt: questionBanks.updatedAt })
      .from(questionBanks)
      .where(and(eq(questionBanks.userId, user.userId), eq(questionBanks.subject, subject)))
      .limit(1);
    const first = row[0];
    return Response.json({
      subject,
      found: Boolean(first),
      questions: first ? JSON.parse(first.questionsJson) : [],
      updatedAt: first?.updatedAt ?? null,
      account: { id: user.userId, email: user.email, displayName: user.displayName },
    });
  } catch (error) {
    console.error("question bank read failed", error);
    return jsonError("云端题库暂时不可用，请稍后重试", 503);
  }
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return jsonError("需要先登录 ChatGPT 账号", 401);

  let payload: { subject?: string; questions?: unknown };
  try {
    payload = (await request.json()) as { subject?: string; questions?: unknown };
  } catch {
    return jsonError("请求不是有效 JSON", 400);
  }

  const subject = parseSubject(payload.subject ?? null);
  if (!subject) return jsonError("subject 必须是 psychology 或 education", 400);

  let parsed: { value: unknown[]; encoded: string };
  try {
    parsed = parseQuestions(payload.questions);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "题库格式不正确", 400);
  }

  const updatedAt = Date.now();
  try {
    await getDb()
      .insert(questionBanks)
      .values({ userId: user.userId, subject, questionsJson: parsed.encoded, updatedAt })
      .onConflictDoUpdate({
        target: [questionBanks.userId, questionBanks.subject],
        set: { questionsJson: parsed.encoded, updatedAt },
      });
    return Response.json({ subject, count: parsed.value.length, updatedAt });
  } catch (error) {
    console.error("question bank write failed", error);
    return jsonError("云端题库保存失败，请稍后重试", 503);
  }
}
