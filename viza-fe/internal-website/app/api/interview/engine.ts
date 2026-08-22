import type {
  AnswerAssessment,
  AnswerRequirement,
  ApplicantProfile,
  InterviewExchange,
  InterviewQuestion,
  InterviewReport,
  InterviewPurpose,
} from "./types";

type QuestionDefinition = {
  id: string;
  topic: string;
  requirements: AnswerRequirement[];
  prompt: (profile: ApplicantProfile) => string;
};

const PURPOSE_LABELS: Record<InterviewPurpose, string> = {
  tourism: "旅游",
  business: "商务活动",
  family_visit: "探亲访友",
  medical: "就医",
  other: "短期访问",
};

const REQUIREMENT_LABELS: Record<AnswerRequirement, string> = {
  detail: "具体事实",
  destination: "城市或地点",
  time: "明确时间",
  money: "金额与资金来源",
  work: "职位与工作安排",
  ties: "回国后的具体安排",
  history: "真实的出境记录",
};

const REQUIREMENT_PATTERNS: Record<Exclude<AnswerRequirement, "detail">, RegExp> = {
  destination: /纽约|洛杉矶|旧金山|芝加哥|波士顿|拉斯维加斯|西雅图|华盛顿|迈阿密|奥兰多|夏威夷|美国|酒店|公园|博物馆|会议|客户|医院|亲属|city|hotel|conference|hospital/i,
  time: /\d|天|周|月|年|号|日期|时间|行程|回程|机票|day|week|month|date|return/i,
  money: /\d|美元|美金|人民币|费用|预算|存款|银行|流水|工资|收入|资助|自费|公司承担|money|budget|salary|saving|fund/i,
  work: /工作|公司|单位|机构|职位|老板|上班|请假|学生|学校|业务|生意|自由职业|退休|job|company|employer|student|school|business/i,
  ties: /家人|父母|孩子|妻子|丈夫|配偶|家庭|房子|房产|工作|公司|学校|回国|回来|项目|客户|责任|return|family|job|home|project/i,
  history: /去过|没有|未曾|从未|第一次|国家|日本|韩国|欧洲|新加坡|泰国|英国|澳洲|加拿大|travel|never|first|visited/i,
};

const GENERIC_WEAK_ANSWERS = /^(不知道|不清楚|随便|没有想好|还没想|无所谓|是|否|有|没有|好|ok|yes|no|1|2)[。.!！]?$/i;

function compact(value: string, fallback: string) {
  return value.trim() || fallback;
}

function purposeQuestion(profile: ApplicantProfile) {
  const purpose = PURPOSE_LABELS[profile.purpose];
  if (profile.purpose === "business") return `你去美国参加什么${purpose}？`;
  if (profile.purpose === "family_visit") return "你去美国看谁？";
  if (profile.purpose === "medical") return "你去美国接受什么治疗？";
  return `你这次去美国做什么${purpose === "旅游" ? "" : `，为什么是${purpose}` }？`;
}

export function buildInterviewPlan(profile: ApplicantProfile): QuestionDefinition[] {
  const destinations = compact(profile.destinations, "计划中的城市");
  const occupation = compact(profile.occupation, "目前的工作或身份");

  return [
    {
      id: "purpose",
      topic: "赴美目的",
      requirements: ["detail"],
      prompt: purposeQuestion,
    },
    {
      id: "itinerary",
      topic: "行程安排",
      requirements: ["destination", "detail"],
      prompt: () => `你在${destinations}具体怎么安排？`,
    },
    {
      id: "duration",
      topic: "停留时间",
      requirements: ["time"],
      prompt: () => "你准备在美国待多久？",
    },
    {
      id: "funding",
      topic: "费用来源",
      requirements: ["money"],
      prompt: () => "谁承担这次旅行费用？",
    },
    {
      id: "employment",
      topic: "工作情况",
      requirements: ["work", "detail"],
      prompt: () => `${occupation}，你具体负责什么？`,
    },
    {
      id: "return_ties",
      topic: "回国安排",
      requirements: ["ties", "detail"],
      prompt: () => "旅行结束后你为什么会按时回国？",
    },
    {
      id: "travel_history",
      topic: "出境记录",
      requirements: ["history"],
      prompt: () => "你以前出过国吗？",
    },
  ];
}

export function getQuestion(profile: ApplicantProfile, index: number): InterviewQuestion | null {
  const definition = buildInterviewPlan(profile)[index];
  if (!definition) return null;
  return {
    id: definition.id,
    topic: definition.topic,
    prompt: definition.prompt(profile),
    isFollowUp: false,
  };
}

function hasRequirement(answer: string, requirement: AnswerRequirement) {
  const text = answer.trim();
  if (requirement === "detail") {
    return text.length >= 12 && !GENERIC_WEAK_ANSWERS.test(text);
  }
  return REQUIREMENT_PATTERNS[requirement].test(text);
}

function profileAnchors(profile: ApplicantProfile, questionId: string) {
  const source = questionId === "purpose"
    ? profile.purposeDetails
    : questionId === "itinerary"
      ? profile.destinations
      : questionId === "duration"
        ? `${profile.travelDates} ${profile.duration}`
        : questionId === "funding"
          ? `${profile.funding} ${profile.budget}`
          : questionId === "employment"
            ? `${profile.occupation} ${profile.employer}`
            : questionId === "return_ties"
              ? profile.homeTies
              : profile.previousTravel;

  return source
    .split(/[\s,，、。;；/]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2)
    .slice(0, 8);
}

export function assessAnswer(
  profile: ApplicantProfile,
  question: InterviewQuestion,
  answer: string,
): AnswerAssessment {
  const definition = buildInterviewPlan(profile).find((item) => item.id === (question.parentId ?? question.id));
  const requirements = definition?.requirements ?? ["detail"];
  const missingRequirements = requirements.filter((requirement) => !hasRequirement(answer, requirement));
  const text = answer.trim();
  const anchors = profileAnchors(profile, question.parentId ?? question.id);
  const anchorMatches = anchors.filter((anchor) => text.toLowerCase().includes(anchor.toLowerCase())).length;

  let score = 42;
  if (text.length >= 8) score += 8;
  if (text.length >= 18) score += 8;
  if (text.length >= 35) score += 5;
  score += (requirements.length - missingRequirements.length) * 12;
  score += Math.min(anchorMatches * 4, 8);
  if (/\d/.test(text)) score += 4;
  if (GENERIC_WEAK_ANSWERS.test(text)) score -= 24;
  score = Math.max(20, Math.min(94, Math.round(score)));

  const status = score >= 78 ? "strong" : score < 60 ? "weak" : "developing";
  const note = missingRequirements.length > 0
    ? `还需说明${missingRequirements.map((item) => REQUIREMENT_LABELS[item]).join("、")}`
    : anchorMatches > 0
      ? "回答具体，并与已确认资料一致"
      : "回答基本完整，可再贴近已确认资料";

  return { score, status, note, missingRequirements };
}

export function buildFollowUp(
  profile: ApplicantProfile,
  question: InterviewQuestion,
  assessment: AnswerAssessment,
): InterviewQuestion | null {
  const missing = assessment.missingRequirements[0];
  if (!missing) return null;

  const prompts: Record<AnswerRequirement, string> = {
    detail: question.id === "purpose"
      ? `具体是什么安排？你确认的目的包括“${compact(profile.purposeDetails, "本次访问")}”。`
      : "请用一句话说清最关键的具体事实。",
    destination: `最主要去哪个城市？你填写的是“${compact(profile.destinations, "尚未填写")}”。`,
    time: `具体待多少天？你填写的是“${compact(profile.duration, "尚未填写")}”。`,
    money: `大约准备多少预算，资金从哪里来？你填写的是“${compact(profile.funding, "尚未填写")}”。`,
    work: `你的职位、单位和请假安排分别是什么？你填写的是“${compact(profile.occupation, "尚未填写")}”。`,
    ties: `回国后哪一项工作或家庭责任必须继续？你填写的是“${compact(profile.homeTies, "尚未填写")}”。`,
    history: `最近一次去了哪里？如果没有，请直接说明是第一次。`,
  };

  return {
    id: `${question.parentId ?? question.id}-follow-up`,
    parentId: question.parentId ?? question.id,
    topic: question.topic,
    prompt: prompts[missing],
    isFollowUp: true,
  };
}

export function processAnswer(input: {
  profile: ApplicantProfile;
  question: InterviewQuestion;
  answer: string;
  questionIndex: number;
  followUpUsed: boolean;
}): {
  assessment: AnswerAssessment;
  nextQuestion: InterviewQuestion | null;
  nextQuestionIndex: number;
  completed: boolean;
} {
  const assessment = assessAnswer(input.profile, input.question, input.answer);
  if (!input.followUpUsed && !input.question.isFollowUp) {
    const followUp = buildFollowUp(input.profile, input.question, assessment);
    if (followUp) {
      return {
        assessment,
        nextQuestion: followUp,
        nextQuestionIndex: input.questionIndex,
        completed: false,
      };
    }
  }

  const nextQuestionIndex = input.questionIndex + 1;
  const nextQuestion = getQuestion(input.profile, nextQuestionIndex);
  return {
    assessment,
    nextQuestion,
    nextQuestionIndex,
    completed: nextQuestion === null,
  };
}

function average(values: number[], fallback = 50) {
  if (values.length === 0) return fallback;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function frameworkFor(questionId: string, profile: ApplicantProfile) {
  const id = questionId.replace(/-follow-up$/, "");
  if (id === "purpose") return `先说“${compact(profile.purposeDetails, PURPOSE_LABELS[profile.purpose])}”，再补一项具体安排。`;
  if (id === "itinerary") return `按“${compact(profile.destinations, "主要城市")} + 每地活动”回答。`;
  if (id === "duration") return `直接说“${compact(profile.duration, "具体天数")}”，再说明返程日期或原因。`;
  if (id === "funding") return `说明“${compact(profile.funding, "资金来源")} + ${compact(profile.budget, "真实预算")}”。`;
  if (id === "employment") return `说明“${compact(profile.employer, "单位")} + ${compact(profile.occupation, "职位")} + 请假安排”。`;
  if (id === "return_ties") return `用“${compact(profile.homeTies, "真实责任")}”解释回国后的明确安排。`;
  return `如实说明“${compact(profile.previousTravel, "是否有出境记录")}”，不要猜测或补造经历。`;
}

export function createInterviewReport(input: {
  profile: ApplicantProfile;
  exchanges: InterviewExchange[];
  idempotencyKey: string;
  generatedAt?: string;
}): InterviewReport {
  const mainExchanges = input.exchanges.filter((exchange) => !exchange.question.isFollowUp);
  const allScores = input.exchanges.map((exchange) => exchange.assessment.score);
  const detailCoverage = input.exchanges.map((exchange) =>
    exchange.assessment.missingRequirements.length === 0 ? 88 : Math.max(35, 76 - exchange.assessment.missingRequirements.length * 18),
  );
  const anchorScores = input.exchanges.map((exchange) => {
    const anchors = profileAnchors(input.profile, exchange.question.parentId ?? exchange.question.id);
    return anchors.some((anchor) => exchange.answer.toLowerCase().includes(anchor.toLowerCase())) ? 88 : 64;
  });
  const ties = input.exchanges.filter((exchange) =>
    (exchange.question.parentId ?? exchange.question.id) === "return_ties",
  );
  const returnIntent = ties.length ? average(ties.map((exchange) => exchange.assessment.score)) : 45;
  const specificity = average(detailCoverage);
  const consistency = average(anchorScores);
  const clarity = average(allScores);
  const completionPenalty = Math.max(0, 7 - mainExchanges.length) * 4;
  const overallScore = Math.max(25, Math.min(95, Math.round(
    clarity * 0.35 + specificity * 0.25 + consistency * 0.2 + returnIntent * 0.2 - completionPenalty,
  )));
  const readiness = overallScore >= 80 ? "准备充分" : overallScore >= 64 ? "接近准备" : "需要加强";

  const ranked = [...input.exchanges].sort((a, b) => b.assessment.score - a.assessment.score);
  const strengths = ranked
    .filter((exchange) => exchange.assessment.status === "strong")
    .slice(0, 2)
    .map((exchange) => ({
      title: `${exchange.question.topic}回答具体`,
      evidence: `“${exchange.answer.slice(0, 42)}${exchange.answer.length > 42 ? "…" : ""}”`,
    }));
  if (strengths.length === 0) {
    strengths.push({
      title: "已完成核心问答",
      evidence: `本次完成 ${input.exchanges.length} 次回答，可据此继续针对性练习。`,
    });
  }

  const weak = [...input.exchanges].sort((a, b) => a.assessment.score - b.assessment.score);
  const actions = weak.slice(0, 3).map((exchange, index) => ({
    priority: (index + 1) as 1 | 2 | 3,
    title: `重练：${exchange.question.topic}`,
    action: `${exchange.assessment.note}。${frameworkFor(exchange.question.id, input.profile)}`,
  }));
  while (actions.length < 3) {
    const priority = (actions.length + 1) as 1 | 2 | 3;
    actions.push({
      priority,
      title: priority === 2 ? "练习 20 秒短答" : "核对 DS-160 与口头表述",
      action: priority === 2
        ? "每题先给结论，再补一个地点、日期、金额或职责，控制在 2 至 3 句。"
        : "逐项核对目的、行程、资金、工作和家庭安排，只使用真实且一致的信息。",
    });
  }

  const riskFlags = input.exchanges
    .filter((exchange) => exchange.assessment.status === "weak")
    .slice(0, 4)
    .map((exchange) => `${exchange.question.topic}：${exchange.assessment.note}`);
  if (mainExchanges.length < 7) riskFlags.push(`提前结束：仅完成 ${mainExchanges.length}/7 个核心主题`);

  return {
    overallScore,
    readiness,
    summary: overallScore >= 80
      ? "核心事实较完整，下一轮重点保持简短、直接和前后一致。"
      : overallScore >= 64
        ? "已有可用基础，但部分回答仍缺少签证官可快速核验的具体事实。"
        : "当前回答存在较多空泛或缺失信息，建议按行动清单完成一轮针对性重练。",
    dimensions: { clarity, specificity, consistency, returnIntent },
    strengths,
    actions,
    riskFlags,
    questionAnalysis: input.exchanges.map((exchange) => ({
      question: exchange.question.prompt,
      answer: exchange.answer,
      topic: exchange.question.topic,
      score: exchange.assessment.score,
      status: exchange.assessment.status,
      note: exchange.assessment.note,
      responseFramework: frameworkFor(exchange.question.id, input.profile),
    })),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    idempotencyKey: input.idempotencyKey,
  };
}
