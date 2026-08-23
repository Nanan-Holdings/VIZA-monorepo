import type {
  AnswerAssessment,
  AnswerRequirement,
  ApplicantProfile,
  InterviewApplicationContext,
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
  work: "职业或学业安排",
  ties: "回国后的具体安排",
  history: "真实的旅行记录",
  companions: "同行人情况",
  contact: "美国联系人情况",
  refusal: "拒签或入境记录",
};

const REQUIREMENT_PATTERNS: Record<Exclude<AnswerRequirement, "detail">, RegExp> = {
  destination: /纽约|洛杉矶|旧金山|芝加哥|波士顿|拉斯维加斯|西雅图|华盛顿|迈阿密|奥兰多|夏威夷|美国|酒店|公园|博物馆|会议|客户|医院|亲属|city|hotel|conference|hospital/i,
  time: /\d|天|周|月|年|号|日期|时间|行程|回程|机票|day|week|month|date|return/i,
  money: /\d|美元|美金|人民币|费用|预算|存款|银行|流水|工资|收入|资助|自费|公司承担|money|budget|salary|saving|fund/i,
  work: /工作|公司|单位|机构|职位|老板|上班|请假|学生|学校|大学|课程|业务|生意|自由职业|退休|job|company|employer|student|school|university|business/i,
  ties: /家人|父母|孩子|妻子|丈夫|配偶|家庭|房子|房产|工作|公司|学校|回国|回来|项目|客户|责任|return|family|job|home|project/i,
  history: /去过|没有|未曾|从未|第一次|国家|日本|韩国|欧洲|新加坡|泰国|英国|澳洲|加拿大|美国|travel|never|first|visited/i,
  companions: /独自|自己|同行|同伴|家人|朋友|同事|团队|没有|无人|alone|companion|family|friend|colleague|group|nobody/i,
  contact: /联系人|亲属|朋友|客户|公司|酒店|学校|无人|没有|不适用|contact|relative|friend|client|company|hotel|school|none|not applicable/i,
  refusal: /拒签|拒绝入境|撤回|没有|未曾|从未|有|时间|地点|原因|refus|denied|withdraw|never|no|yes/i,
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
  return `你这次去美国做什么${purpose === "旅游" ? "" : `，为什么是${purpose}`}？`;
}

export function buildInterviewPlan(profile: ApplicantProfile): QuestionDefinition[] {
  const destinations = compact(profile.destinations, "计划中的城市");
  const occupation = compact(profile.occupation, "目前的职业或学业身份");
  return [
    { id: "purpose", topic: "赴美目的", requirements: ["detail"], prompt: purposeQuestion },
    { id: "itinerary", topic: "行程安排", requirements: ["destination", "detail"], prompt: () => `你在${destinations}具体怎么安排？` },
    { id: "duration", topic: "停留时间", requirements: ["time"], prompt: () => "你准备在美国待多久？" },
    { id: "funding", topic: "费用来源", requirements: ["money"], prompt: () => "谁承担这次旅行费用，预算如何安排？" },
    { id: "employment_education", topic: "职业或学业", requirements: ["work", "detail"], prompt: () => `${occupation}，你具体的工作或学业安排是什么？` },
    { id: "companions_contact", topic: "同行人与美国联系人", requirements: ["companions", "contact"], prompt: () => "这次是否有人同行，你在美国的联系人是谁或是什么机构？" },
    { id: "travel_refusal_history", topic: "旅行与拒签记录", requirements: ["history", "refusal"], prompt: () => "请如实说明既往出境、赴美和拒签或被拒绝入境的情况。" },
    { id: "return_ties", topic: "回国约束", requirements: ["ties", "detail"], prompt: () => "旅行结束后，哪些具体工作、学业或家庭安排要求你按时回国？" },
  ];
}

export function getQuestion(profile: ApplicantProfile, index: number): InterviewQuestion | null {
  const definition = buildInterviewPlan(profile)[index];
  if (!definition) return null;
  return { id: definition.id, topic: definition.topic, prompt: definition.prompt(profile), isFollowUp: false };
}

function hasRequirement(answer: string, requirement: AnswerRequirement) {
  const text = answer.trim();
  return requirement === "detail"
    ? text.length >= 12 && !GENERIC_WEAK_ANSWERS.test(text)
    : REQUIREMENT_PATTERNS[requirement].test(text);
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
          : questionId === "employment_education"
            ? `${profile.occupation} ${profile.employer}`
            : questionId === "companions_contact"
              ? `${profile.companions ?? ""} ${profile.usContact ?? ""}`
              : questionId === "travel_refusal_history"
                ? `${profile.previousTravel} ${profile.refusalHistory ?? ""}`
                : profile.homeTies;
  return source.split(/[\s,，、。;；/]+/).map((part) => part.trim()).filter((part) => part.length >= 2).slice(0, 10);
}

export function assessAnswer(
  profile: ApplicantProfile,
  question: InterviewQuestion,
  answer: string,
  context?: InterviewApplicationContext,
): AnswerAssessment {
  const questionId = question.parentId ?? question.id;
  const definition = buildInterviewPlan(profile).find((item) => item.id === questionId);
  const requirements = definition?.requirements ?? ["detail"];
  const missingRequirements = requirements.filter((requirement) => !hasRequirement(answer, requirement));
  const text = answer.trim();
  const anchors = profileAnchors(profile, questionId);
  const anchorMatches = anchors.filter((anchor) => text.toLowerCase().includes(anchor.toLowerCase())).length;
  const completeness = Math.max(20, Math.round(100 * (requirements.length - missingRequirements.length) / requirements.length));
  const specificity = Math.max(20, Math.min(96, 35 + Math.min(text.length, 45) + (/\d/.test(text) ? 8 : 0)));
  const canVerify = context?.source === "application" && anchors.length > 0;
  const consistency = canVerify && anchorMatches > 0 ? Math.min(96, 84 + anchorMatches * 4) : null;
  const consistencyStatus = consistency === null ? "unverified" : "verified";
  let score = Math.round(completeness * 0.55 + specificity * 0.45);
  if (consistency !== null) score = Math.round(score * 0.9 + consistency * 0.1);
  if (GENERIC_WEAK_ANSWERS.test(text)) score -= 24;
  score = Math.max(20, Math.min(94, score));
  const status = score >= 78 ? "strong" : score < 60 ? "weak" : "developing";
  const note = missingRequirements.length > 0
    ? `还需说明${missingRequirements.map((item) => REQUIREMENT_LABELS[item]).join("、")}`
    : consistencyStatus === "verified"
      ? "回答具体，并与已保存申请中的可核验事实一致"
      : "回答基本完整；与申请资料的一致性未核验";
  return { score, status, note, missingRequirements, dimensions: { completeness, specificity, consistency, consistencyStatus } };
}

export function buildFollowUp(profile: ApplicantProfile, question: InterviewQuestion, assessment: AnswerAssessment): InterviewQuestion | null {
  const missing = assessment.missingRequirements[0];
  if (!missing) return null;
  const prompts: Record<AnswerRequirement, string> = {
    detail: question.id === "purpose" ? "请用真实事实说明访问目的和一项具体安排。" : "请用一句话说清最关键的具体事实。",
    destination: `最主要去哪个城市？练习资料中记录的是“${compact(profile.destinations, "尚未填写")}”。`,
    time: `具体待多少天？练习资料中记录的是“${compact(profile.duration, "尚未填写")}”。`,
    money: `大约准备多少预算，资金从哪里来？练习资料中记录的是“${compact(profile.funding, "尚未填写")}”。`,
    work: "你的职位或学业、单位以及请假或假期安排分别是什么？",
    ties: "回国后哪一项工作、学业或家庭责任必须继续？",
    history: "最近一次去了哪里？如果没有出境记录，请直接说明。",
    companions: "请明确说明是独自出行，还是与哪些关系的人同行。",
    contact: "请说明美国联系人的关系或机构类型；没有个人联系人也请如实说明。",
    refusal: "请明确说明是否曾被拒签、拒绝入境或撤回入境申请；如有，请如实说明时间与原因。",
  };
  return { id: `${question.parentId ?? question.id}-follow-up`, parentId: question.parentId ?? question.id, topic: question.topic, prompt: prompts[missing], isFollowUp: true };
}

export function processAnswer(input: {
  profile: ApplicantProfile;
  question: InterviewQuestion;
  answer: string;
  questionIndex: number;
  followUpUsed: boolean;
  context?: InterviewApplicationContext;
}) {
  const assessment = assessAnswer(input.profile, input.question, input.answer, input.context);
  if (!input.followUpUsed && !input.question.isFollowUp) {
    const followUp = buildFollowUp(input.profile, input.question, assessment);
    if (followUp) return { assessment, nextQuestion: followUp, nextQuestionIndex: input.questionIndex, completed: false };
  }
  const nextQuestionIndex = input.questionIndex + 1;
  const nextQuestion = getQuestion(input.profile, nextQuestionIndex);
  return { assessment, nextQuestion, nextQuestionIndex, completed: nextQuestion === null };
}

function average(values: number[], fallback = 50) {
  return values.length === 0 ? fallback : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function frameworkFor(questionId: string, profile: ApplicantProfile) {
  const id = questionId.replace(/-follow-up$/, "");
  if (id === "purpose") return "先说真实访问目的，再补一项具体安排。";
  if (id === "itinerary") return `按“${compact(profile.destinations, "主要城市")} + 每地活动”回答。`;
  if (id === "duration") return `直接说“${compact(profile.duration, "具体天数")}”，再说明返程日期或原因。`;
  if (id === "funding") return `说明“${compact(profile.funding, "资金来源")} + ${compact(profile.budget, "真实预算")}”。`;
  if (id === "employment_education") return "说明当前职业或学业、单位以及请假或假期安排。";
  if (id === "companions_contact") return "分别说明同行人关系和美国联系人或机构类型。";
  if (id === "travel_refusal_history") return "分开、如实说明旅行记录与拒签或入境记录，不补造经历。";
  return "用真实的工作、学业或家庭责任解释回国后的明确安排。";
}

export function createInterviewReport(input: {
  profile: ApplicantProfile;
  exchanges: InterviewExchange[];
  idempotencyKey: string;
  context?: InterviewApplicationContext;
  generatedAt?: string;
}): InterviewReport {
  const expectedTopics = buildInterviewPlan(input.profile).length;
  const exchanges = input.exchanges.map((exchange) => ({ ...exchange, assessment: assessAnswer(input.profile, exchange.question, exchange.answer, input.context) }));
  const mainExchanges = exchanges.filter((exchange) => !exchange.question.isFollowUp);
  const clarity = average(exchanges.map((exchange) => exchange.assessment.score));
  const completeness = average(exchanges.map((exchange) => exchange.assessment.dimensions!.completeness));
  const specificity = average(exchanges.map((exchange) => exchange.assessment.dimensions!.specificity));
  const verifiedConsistency = exchanges.map((exchange) => exchange.assessment.dimensions!.consistency).filter((value): value is number => value !== null);
  const consistency = verifiedConsistency.length > 0 ? average(verifiedConsistency) : null;
  const consistencyStatus = consistency === null ? "unverified" : "verified";
  const ties = exchanges.filter((exchange) => (exchange.question.parentId ?? exchange.question.id) === "return_ties");
  const returnIntent = ties.length ? average(ties.map((exchange) => exchange.assessment.score)) : 45;
  const completionPenalty = Math.max(0, expectedTopics - mainExchanges.length) * 4;
  const weighted = consistency === null
    ? clarity * 0.3 + completeness * 0.3 + specificity * 0.25 + returnIntent * 0.15
    : clarity * 0.25 + completeness * 0.25 + specificity * 0.2 + consistency * 0.15 + returnIntent * 0.15;
  const overallScore = Math.max(25, Math.min(95, Math.round(weighted - completionPenalty)));
  const readiness = overallScore >= 80 ? "准备充分" : overallScore >= 64 ? "接近准备" : "需要加强";
  const strengths = [...exchanges].sort((a, b) => b.assessment.score - a.assessment.score).filter((exchange) => exchange.assessment.status === "strong").slice(0, 2).map((exchange) => ({ title: `${exchange.question.topic}回答具体`, evidence: `“${exchange.answer.slice(0, 42)}${exchange.answer.length > 42 ? "…" : ""}”` }));
  if (strengths.length === 0) strengths.push({ title: "已完成核心问答", evidence: `本次完成 ${exchanges.length} 次回答，可据此继续针对性练习。` });
  const actions = [...exchanges].sort((a, b) => a.assessment.score - b.assessment.score).slice(0, 3).map((exchange, index) => ({ priority: (index + 1) as 1 | 2 | 3, title: `重练：${exchange.question.topic}`, action: `${exchange.assessment.note}。${frameworkFor(exchange.question.id, input.profile)}` }));
  while (actions.length < 3) {
    const priority = (actions.length + 1) as 1 | 2 | 3;
    actions.push({ priority, title: priority === 2 ? "练习 20 秒短答" : "核对 DS-160 与口头表述", action: priority === 2 ? "每题先给结论，再补一个地点、日期、金额或职责，控制在 2 至 3 句。" : "逐项核对目的、行程、资金、工作或学业和回国安排，只使用真实信息。" });
  }
  const riskFlags = exchanges.filter((exchange) => exchange.assessment.status === "weak").slice(0, 4).map((exchange) => `${exchange.question.topic}：${exchange.assessment.note}`);
  if (mainExchanges.length < expectedTopics) riskFlags.push(`提前结束：仅完成 ${mainExchanges.length}/${expectedTopics} 个核心主题`);
  if (consistency === null) riskFlags.push("与已保存申请的一致性未核验");
  return {
    overallScore,
    readiness,
    summary: overallScore >= 80 ? "核心事实较完整，下一轮重点保持简短、直接和前后一致。" : overallScore >= 64 ? "已有可用基础，但部分回答仍缺少可快速核验的具体事实。" : "当前回答存在较多空泛或缺失信息，建议按行动清单完成一轮针对性重练。",
    dimensions: { clarity, completeness, specificity, consistency, consistencyStatus, returnIntent },
    strengths,
    actions,
    riskFlags,
    questionAnalysis: exchanges.map((exchange) => ({ question: exchange.question.prompt, answer: exchange.answer, topic: exchange.question.topic, score: exchange.assessment.score, status: exchange.assessment.status, note: exchange.assessment.note, responseFramework: frameworkFor(exchange.question.id, input.profile) })),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    idempotencyKey: input.idempotencyKey,
    disclaimer: "本报告仅用于面试练习，不预测、保证或代表任何签证结果。",
  };
}
