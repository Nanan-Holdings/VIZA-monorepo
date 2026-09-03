import { NextRequest } from "next/server";
import { getClientSessionWithFallback } from "@/lib/client-session";
import { consumeRateLimit, exceedsBodyLimit, getClientIp } from "@/lib/api/rate-limit-ip";

type Message = { role: "user" | "assistant"; content: string };

const MAX_MESSAGES = 120;
const MAX_MESSAGE_CHARS = 4_000;
const MAX_BODY_BYTES = 512 * 1024;

/** Validate the client-controlled `messages` array is a well-formed interview transcript. */
function isValidMessages(value: unknown): value is Message[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > MAX_MESSAGES) return false;
  return value.every(
    (item) =>
      Boolean(item) &&
      typeof item === "object" &&
      ((item as Message).role === "user" || (item as Message).role === "assistant") &&
      typeof (item as Message).content === "string" &&
      (item as Message).content.length <= MAX_MESSAGE_CHARS,
  );
}

/**
 * Practice-session summary.
 *
 * Deliberately NOT included: a pass-likelihood verdict, a per-question
 * good/bad judgement, or "how to answer better" suggestions. We cannot predict a
 * consular officer's decision, and coaching someone on how to phrase answers for
 * a visa interview is not something we should be doing. What's left is a factual
 * record of what was asked and what the applicant said, plus a rough delivery
 * score so they can see whether they're getting more fluent with practice.
 */
export interface InterviewReport {
  overallScore: number;
  dimensions: {
    clarity: number;
    confidence: number;
    consistency: number;
    narrativeAlignment: number;
  };
  questionAnalysis: Array<{
    question: string;
    answer: string;
    timestamp: string;
    topic: string;
  }>;
}

// OpenAI-compatible endpoint. Defaults to local Ollama in development; point
// LLM_BASE_URL at api.openai.com/v1 (with a real LLM_API_KEY) to use a hosted
// provider instead. In production an unset LLM_BASE_URL resolves to null so we
// never silently forward applicant transcripts to a localhost default — the
// caller falls back to the deterministic local report instead.
function resolveLlmBaseUrl(): string | null {
  const configured = process.env.LLM_BASE_URL?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return null;
  return "http://localhost:11434/v1";
}
// Report = a pure scoring task, so default to a smaller/faster model than the
// interviewer. Override with LLM_REPORT_MODEL (falls back to the shared model).
const LLM_MODEL =
  process.env.LLM_REPORT_MODEL ?? process.env.LLM_MODEL ?? "qwen2.5:3b";
const LLM_API_KEY =
  process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? "ollama";

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function timestampForIndex(i: number): string {
  const totalSecs = Math.floor(i * 47 + 37);
  const mins = String(Math.floor(totalSecs / 60)).padStart(2, "0");
  const secs = String(totalSecs % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function clampScore(score: number): number {
  return Math.max(35, Math.min(92, Math.round(score)));
}

function localScore(question: string, answer: string): LlmScore {
  const text = answer.trim();
  let score = 50;
  if (text.length >= 8) score += 8;
  if (text.length >= 18) score += 8;
  if (text.length >= 36) score += 6;
  if (/\d/.test(text)) score += 6;
  if (/纽约|洛杉矶|旧金山|芝加哥|波士顿|拉斯维加斯|西雅图|华盛顿|迈阿密|奥兰多|夏威夷|城市/i.test(text)) score += 6;
  if (/美元|美金|人民币|费用|预算|存款|银行|流水|工资|收入|资助|自费|钱/.test(text)) score += 6;
  if (/天|周|月|号|日期|时间|行程|回程|机票/.test(text)) score += 5;
  if (/工作|公司|单位|机构|职位|上班|请假|学生|学校|业务|生意/.test(text)) score += 5;
  if (/家人|父母|孩子|妻子|丈夫|配偶|家庭|房子|回国|回来|项目/.test(text)) score += 5;
  if (/不知道|随便|没有|不清楚|还没想|无所谓|^1$|^好$/.test(text)) score -= 18;

  const finalScore = clampScore(score);
  const flag = finalScore >= 78 ? "strong" : finalScore < 62 ? "weak" : "neutral";
  const topic = /费用|预算|资助/.test(question) ? "资金"
    : /工作|公司|机构/.test(question) ? "工作"
    : /家里|牵挂|回国/.test(question) ? "约束"
    : /城市|住宿|行程/.test(question) ? "行程"
    : /多长|回程|时间/.test(question) ? "时间"
    : "目的";
  const note = flag === "strong" ? "细节较具体"
    : flag === "weak" ? "缺少关键事实"
    : "可再补充细节";

  return { index: 0, score: finalScore, flag, note, topic };
}

function buildLocalReport(messages: Message[]): InterviewReport {
  const pairs = buildPairs(messages).filter((pair) => pair.question !== "好的，今天的面试到这里就结束了，感谢您的配合。");
  const scored = pairs.map((pair, i) => ({ pair, i, score: localScore(pair.question, pair.answer) }));
  const avg = scored.length
    ? scored.reduce((sum, item) => sum + item.score.score, 0) / scored.length
    : 60;
  const weakCount = scored.filter((item) => item.score.flag === "weak").length;
  const strong = scored.find((item) => item.score.flag === "strong");
  const overallScore = clampScore(avg - Math.max(0, weakCount - 2) * 4);

  return {
    overallScore,
    dimensions: {
      clarity: clampScore(avg + 4),
      confidence: clampScore(avg - (weakCount * 2)),
      consistency: clampScore(avg - (weakCount * 3)),
      narrativeAlignment: clampScore(avg + (strong ? 2 : -2)),
    },
    questionAnalysis: scored.map(({ pair, i, score }) => ({
      question: truncate(pair.question, 60),
      answer: truncate(pair.answer, 60),
      timestamp: timestampForIndex(i),
      topic: score.topic,
    })),
  };
}

/** Pair each officer question with the applicant's immediate answer. */
function buildPairs(messages: Message[]): { question: string; answer: string }[] {
  const pairs: { question: string; answer: string }[] = [];
  for (let i = 0; i < messages.length - 1; i++) {
    if (messages[i].role === "assistant" && messages[i + 1].role === "user") {
      pairs.push({
        question: messages[i].content,
        answer: messages[i + 1].content,
      });
    }
  }
  return pairs;
}

type LlmScore = {
  index: number;
  score: number;
  flag: "strong" | "neutral" | "weak";
  note: string;
  topic: string;
};

export async function POST(request: NextRequest) {
  const session = await getClientSessionWithFallback();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (exceedsBodyLimit(request, MAX_BODY_BYTES)) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }
  if (
    !consumeRateLimit(`interview-report:${session.userId}`, { limit: 20, windowMs: 60_000 }) ||
    !consumeRateLimit(`interview-report-ip:${getClientIp(request)}`, { limit: 40, windowMs: 60_000 })
  ) {
    return Response.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  }

  let messages: Message[];
  try {
    ({ messages } = (await request.json()) as { messages: Message[] });
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!isValidMessages(messages)) {
    return Response.json({ error: "对话记录不足，无法生成报告" }, { status: 400 });
  }

  const pairs = buildPairs(messages);
  if (pairs.length === 0) {
    return Response.json({ error: "对话记录不足，无法生成报告" }, { status: 400 });
  }

  const llmBaseUrl = resolveLlmBaseUrl();
  if (!llmBaseUrl) {
    // Production with no LLM endpoint configured: serve the deterministic local
    // report instead of reaching out to a localhost default.
    return Response.json(buildLocalReport(messages));
  }

  // The model only scores each numbered Q&A; the question/answer text itself is
  // filled back in server-side so the model has far fewer tokens to generate.
  const numbered = pairs
    .map(
      (p, i) =>
        `${i + 1}. 问：${truncate(p.question, 80)}\n   答：${truncate(p.answer, 120)}`
    )
    .join("\n");

  const prompt = `你是严格的美国签证面试评估专家。以下是 B1/B2 模拟面试的问答（已编号）：

${numbered}

【评分标准 — 必须严格执行】
- 40-55分（差）：回答含糊、单字、答非所问、"不知道"、"随便"、纯数字如"1"
- 56-69分（一般）：回答有意义但缺乏具体细节，如只说"去旅游"没有目的地/时间/金额
- 70-79分（良好）：回答完整，有基本事实（城市、时间、金额等）
- 80-90分（优秀）：回答具体详细，有具体数字/地点/计划，逻辑清晰
- 90分以上：极少见，仅限回答非常完整且毫无破绽

请认真阅读每一条回答，只返回以下 JSON，不要输出多余文字：

{
  "overallScore": <0-100 整数，严格按评分标准>,
  "dimensions": { "clarity": <0-100>, "confidence": <0-100>, "consistency": <0-100>, "narrativeAlignment": <0-100> },
  "questions": [
    { "index": <题号整数>, "score": <0-100>, "topic": <4字以内话题> }
  ]
}

不要输出通过概率、每题优劣判断，或如何改进回答的建议。

评分维度：clarity 表达清晰度、confidence 回答的置信感、consistency 前后一致性、narrativeAlignment 与真实情况的符合度。`;

  try {
    const res = await fetch(`${llmBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LLM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        ...(!llmBaseUrl.includes("api.openai.com") ? { temperature: 0.3 } : {}),
        ...(llmBaseUrl.includes("api.openai.com")
          ? { max_completion_tokens: 1200 }
          : { max_tokens: 1200 }),
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json({ error: text }, { status: res.status });
    }

    const payload = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const raw = (payload.choices[0]?.message?.content ?? "{}")
      .trim()
      .replace(/^```(?:json)?\s*/, "")
      .replace(/```\s*$/, "");

    let parsed: {
      overallScore: number;
      dimensions: InterviewReport["dimensions"];
      questions: LlmScore[];
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return Response.json(buildLocalReport(messages));
    }

    const scoreByIndex = new Map<number, LlmScore>();
    for (const q of parsed.questions ?? []) {
      scoreByIndex.set(q.index, q);
    }

    // Merge model scoring with the real question/answer text from the transcript.
    const questionAnalysis: InterviewReport["questionAnalysis"] = pairs.map(
      (pair, i) => {
        const s = scoreByIndex.get(i + 1);
        return {
          question: truncate(pair.question, 60),
          answer: truncate(pair.answer, 60),
          timestamp: timestampForIndex(i),
          topic: s?.topic ?? "综合评估",
        };
      }
    );

    const report: InterviewReport = {
      overallScore: clampScore(parsed.overallScore ?? 70),
      dimensions: parsed.dimensions ?? {
        clarity: 70,
        confidence: 70,
        consistency: 70,
        narrativeAlignment: 70,
      },
      questionAnalysis,
    };

    return Response.json(report);
  } catch {
    return Response.json(buildLocalReport(messages));
  }
}
