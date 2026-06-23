import { NextRequest } from "next/server";

type Message = { role: "user" | "assistant"; content: string };

export interface InterviewReport {
  overallScore: number;
  passLikelihood: "高" | "中" | "低";
  dimensions: {
    clarity: number;
    confidence: number;
    consistency: number;
    narrativeAlignment: number;
  };
  strengths: string[];
  improvements: string[];
  questionAnalysis: Array<{
    question: string;
    answer: string;
    score: number;
    flag: "strong" | "neutral" | "weak";
    flagLabel: string;
    note: string;
    timestamp: string;
    topic: string;
  }>;
}

// OpenAI-compatible endpoint. Defaults to local Ollama; point LLM_BASE_URL at
// api.openai.com/v1 (with a real LLM_API_KEY) to use a hosted provider instead.
const LLM_BASE_URL = process.env.LLM_BASE_URL ?? "http://localhost:11434/v1";
// Report = a pure scoring task, so default to a smaller/faster model than the
// interviewer. Override with LLM_REPORT_MODEL (falls back to the shared model).
const LLM_MODEL =
  process.env.LLM_REPORT_MODEL ?? process.env.LLM_MODEL ?? "qwen2.5:3b";
const LLM_API_KEY =
  process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? "ollama";

const FLAG_LABELS: Record<"strong" | "neutral" | "weak", string> = {
  strong: "表现最优",
  neutral: "中性",
  weak: "需要注意",
};

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function timestampForIndex(i: number): string {
  const totalSecs = Math.floor(i * 47 + 37);
  const mins = String(Math.floor(totalSecs / 60)).padStart(2, "0");
  const secs = String(totalSecs % 60).padStart(2, "0");
  return `${mins}:${secs}`;
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
  let messages: Message[];
  try {
    ({ messages } = (await request.json()) as { messages: Message[] });
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!messages || messages.length < 2) {
    return Response.json({ error: "对话记录不足，无法生成报告" }, { status: 400 });
  }

  const pairs = buildPairs(messages);
  if (pairs.length === 0) {
    return Response.json({ error: "对话记录不足，无法生成报告" }, { status: 400 });
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

【passLikelihood 判断规则】
- 如果超过3题回答是单字、乱码、"1"、"不知道"类敷衍内容，必须给"低"
- 如果多数回答缺乏细节，给"中"
- 只有回答普遍具体且逻辑一致，才给"高"

请认真阅读每一条回答，根据申请人的真实表现评估，只返回以下 JSON，不要输出多余文字：

{
  "overallScore": <0-100 整数，严格按评分标准>,
  "passLikelihood": <"高"|"中"|"低">,
  "dimensions": { "clarity": <0-100>, "confidence": <0-100>, "consistency": <0-100>, "narrativeAlignment": <0-100> },
  "strengths": [
    <2-3条优势，必须引用申请人的具体回答内容，说明哪道题好在哪里，每条不超过30字。如果没有明显优势，如实说明>
  ],
  "improvements": [
    <2-3条改进建议，必须指出具体哪道题有什么问题，给出可操作的改进方向，每条不超过35字>
  ],
  "questions": [
    { "index": <题号整数>, "score": <0-100>, "flag": <"strong"|"neutral"|"weak">, "note": <针对该题回答的具体点评，不超过20字>, "topic": <4字以内话题> }
  ]
}

评分维度：clarity 表达清晰度、confidence 回答的置信感、consistency 前后一致性、narrativeAlignment 与真实情况的符合度。`;

  try {
    const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LLM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        temperature: 0.3,
        max_tokens: 800,
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
      passLikelihood: "高" | "中" | "低";
      dimensions: InterviewReport["dimensions"];
      strengths: string[];
      improvements: string[];
      questions: LlmScore[];
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return Response.json({ error: "报告解析失败，请重试" }, { status: 500 });
    }

    const scoreByIndex = new Map<number, LlmScore>();
    for (const q of parsed.questions ?? []) {
      scoreByIndex.set(q.index, q);
    }

    // Merge model scoring with the real question/answer text from the transcript.
    const questionAnalysis: InterviewReport["questionAnalysis"] = pairs.map(
      (pair, i) => {
        const s = scoreByIndex.get(i + 1);
        const flag = s?.flag ?? "neutral";
        return {
          question: truncate(pair.question, 60),
          answer: truncate(pair.answer, 60),
          score: s?.score ?? 70,
          flag,
          flagLabel: FLAG_LABELS[flag] ?? "中性",
          note: s?.note ?? "回答基本符合要求",
          timestamp: timestampForIndex(i),
          topic: s?.topic ?? "综合评估",
        };
      }
    );

    const report: InterviewReport = {
      overallScore: parsed.overallScore ?? 70,
      passLikelihood: parsed.passLikelihood ?? "中",
      dimensions: parsed.dimensions ?? {
        clarity: 70,
        confidence: 70,
        consistency: 70,
        narrativeAlignment: 70,
      },
      strengths: parsed.strengths ?? [],
      improvements: parsed.improvements ?? [],
      questionAnalysis,
    };

    return Response.json(report);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Report generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
