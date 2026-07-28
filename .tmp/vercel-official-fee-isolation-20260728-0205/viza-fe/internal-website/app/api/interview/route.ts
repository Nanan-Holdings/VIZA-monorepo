import { NextRequest } from "next/server";

type Message = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `你是美国驻华领事馆签证官，正在进行 B1/B2 签证面试。

按顺序问完以下全部12个问题，每次只说一个问题，不解释不闲聊：

Q1: 这次去美国主要是什么打算？
Q2: 具体去做什么？
Q3: 为什么选这个时间去？
Q4: 计划去哪些城市？
Q5: 打算在美国待多长时间？
Q6: 回程机票订了吗？
Q7: 住宿安排好了吗？
Q8: 这次费用自己出还是有人资助？
Q9: 大概预算多少？
Q10: 目前在国内做什么工作？
Q11: 在哪家公司或机构？
Q12: 家里还有什么牵挂，回国后有什么安排？

规则：
1. 数一下对话记录里你已经说过几句话，下一句就问对应编号的问题。例如你已说过3句，就问Q4。
2. 每次只问一个问题，不要把多个问题合并。
3. Q12回答完后，说这句话结束面试："好的，今天的面试到这里就结束了，感谢您的配合。"
4. 第一句话直接问Q1，不要打招呼，不要自我介绍。`;

const LLM_BASE_URL = process.env.LLM_BASE_URL ?? "http://localhost:11434/v1";
const LLM_MODEL = process.env.LLM_MODEL ?? "qwen2.5:7b";
const LLM_API_KEY =
  process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? "ollama";

export async function POST(request: NextRequest) {
  let messages: Message[];
  try {
    ({ messages } = (await request.json()) as { messages: Message[] });
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LLM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        stream: true,
        temperature: 0.3,
        max_tokens: 150,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text();
      return Response.json({ error: text }, { status: upstream.status });
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Interview service error";
    return Response.json({ error: message }, { status: 500 });
  }
}
