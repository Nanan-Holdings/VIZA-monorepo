import { NextRequest } from "next/server";
import { normalizeInterfaceLocale, type InterfaceLocale } from "@/lib/i18n/locale";

type Message = { role: "user" | "assistant"; content: string };
type ApplicantProfile = {
  purpose?: string;
  cities?: string;
  travelDates?: string;
  duration?: string;
  funding?: string;
  occupation?: string;
  familyTies?: string;
};
type TurnDirective = {
  question: string;
  topic: string;
  isFollowUp?: boolean;
  shouldEnd?: boolean;
};
type Officer = {
  name?: string;
  style?: string;
  pressure?: string;
};

function profileLine(profile?: ApplicantProfile) {
  if (!profile) return "申请人未提供预填资料。";
  const items = [
    ["赴美目的", profile.purpose],
    ["计划城市", profile.cities],
    ["出行时间", profile.travelDates],
    ["停留时间", profile.duration],
    ["费用来源", profile.funding],
    ["工作/身份", profile.occupation],
    ["回国牵挂", profile.familyTies],
  ].filter(([, value]) => value?.trim());
  return items.length
    ? items.map(([label, value]) => `${label}：${value}`).join("\n")
    : "申请人未提供预填资料。";
}

function buildSystemPrompt(locale: InterfaceLocale, profile?: ApplicantProfile, directive?: TurnDirective, officer?: Officer) {
  return `你是美国驻华领事馆签证官，正在进行 B1/B2 签证面试。

申请人预填资料：
${profileLine(profile)}

当前回合指令：
主题：${directive?.topic ?? "综合"}
基础问题：${directive?.question ?? fallbackQuestions(locale)[0]}
是否追问：${directive?.isFollowUp ? "是" : "否"}
是否结束：${directive?.shouldEnd ? "是" : "否"}

当前面试官：${officer?.name ?? "标准面试官"}
提问风格：${officer?.style ?? "中性、简洁、专业"}
压力程度：${officer?.pressure ?? "标准"}

规则：
1. 严格执行当前回合指令，不自行跳题、增加题目或结束面试。
2. 模拟真实签证窗口：语气中性、直接、略有压力，不热情寒暄，也不故意刁难。
3. 每次只输出一个简短问题，不解释、不评价、不教学，不说“建议”“请详细说明”“证明材料”等辅导话术。
4. 主问题可结合预填资料自然表达；追问必须紧扣申请人上一条回答中缺失、含糊或需要核实的一件事实。
5. 不替申请人补充事实，不暗示理想答案，不一次询问两个事项。
6. ${locale === "en" ? "Respond only in English, using a short, natural interview question. The selected interface language overrides the language of previous messages, applicant answers and profile data." : "仅使用中文回复。所选界面语言优先于历史消息和申请人答案的语言。优先使用真实窗口常见短句，通常8至22个汉字，最长不超过30个汉字。"}
7. 如果“是否结束”为是，只输出："${endingMessage(locale)}"`;
}

const FALLBACK_QUESTIONS = [
  "这次去美国主要是什么打算？",
  "具体去做什么？",
  "为什么选这个时间去？",
  "计划去哪些城市？",
  "打算在美国待多长时间？",
  "回程机票订了吗？",
  "住宿安排好了吗？",
  "这次费用自己出还是有人资助？",
  "大概预算多少？",
  "目前在国内做什么工作？",
  "在哪家公司或机构？",
  "家里还有什么牵挂，回国后有什么安排？",
];

const ENGLISH_FALLBACK_QUESTIONS = [
  "What is the main purpose of your visit to the United States?",
  "What will you do there?",
  "Why are you traveling at this time?",
  "Which cities will you visit?",
  "How long will you stay in the United States?",
  "Have you booked your return flight?",
  "Have you arranged accommodation?",
  "Who will pay for your trip?",
  "What is your budget?",
  "What do you do for work in your home country?",
  "Which company or organization do you work for?",
  "What family ties and plans will bring you home?",
];

function fallbackQuestions(locale: InterfaceLocale) {
  return locale === "en" ? ENGLISH_FALLBACK_QUESTIONS : FALLBACK_QUESTIONS;
}

function endingMessage(locale: InterfaceLocale) {
  return locale === "en"
    ? "That concludes today's interview. Thank you for your time."
    : "好的，今天的面试到这里就结束了，感谢您的配合。";
}

function localOfficerReply(locale: InterfaceLocale, messages: Message[], directive?: TurnDirective) {
  if (directive?.shouldEnd) return endingMessage(locale);
  if (directive?.question) return directive.question;
  const asked = messages.filter((m) => m.role === "assistant").length;
  const lastAnswer = [...messages].reverse().find((m) => m.role === "user")?.content.trim() ?? "";
  if (asked > 0 && lastAnswer.length > 0 && lastAnswer.length < 8) {
    return locale === "en" ? "Could you be more specific?" : "请具体一点。";
  }
  if (asked >= FALLBACK_QUESTIONS.length) {
    return endingMessage(locale);
  }
  return fallbackQuestions(locale)[asked];
}

function sseText(text: string) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

const LLM_BASE_URL = process.env.LLM_BASE_URL ?? "http://localhost:11434/v1";
const LLM_MODEL = process.env.LLM_MODEL ?? "qwen2.5:7b";
const LLM_API_KEY =
  process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? "ollama";

export async function POST(request: NextRequest) {
  let locale = normalizeInterfaceLocale(request.cookies.get("NEXT_LOCALE")?.value ?? "zh");
  let messages: Message[];
  let profile: ApplicantProfile | undefined;
  let directive: TurnDirective | undefined;
  let officer: Officer | undefined;
  try {
    const body = (await request.json()) as {
      messages: Message[];
      profile?: ApplicantProfile;
      directive?: TurnDirective;
      officer?: Officer;
      locale?: string;
    };
    ({ messages, profile, directive, officer } = body);
    if (body.locale) locale = normalizeInterfaceLocale(body.locale);
    if (!Array.isArray(messages)) throw new Error("Invalid messages");
  } catch {
    return Response.json({ error: locale === "en" ? "Invalid interview request." : "面试请求无效。" }, { status: 400 });
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
        ...(!LLM_BASE_URL.includes("api.openai.com") ? { temperature: 0.2 } : {}),
        ...(LLM_BASE_URL.includes("api.openai.com")
          ? { max_completion_tokens: 80 }
          : { max_tokens: 80 }),
        messages: [
          { role: "system", content: buildSystemPrompt(locale, profile, directive, officer) },
          ...messages,
        ],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      return sseText(localOfficerReply(locale, messages, directive));
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    return sseText(localOfficerReply(locale, messages, directive));
  }
}
