import { describe, expect, it } from "vitest";
import { buildFollowUp, createInterviewReport, getQuestion, processAnswer } from "./engine";
import type { ApplicantProfile, InterviewExchange } from "./types";

const profile: ApplicantProfile = { purpose: "tourism", purposeDetails: "与家人去美国旅游", destinations: "旧金山和洛杉矶", travelDates: "2026年10月", duration: "12天", funding: "本人用工资和存款承担", budget: "3万元人民币", occupation: "产品经理", employer: "VIZA", homeTies: "假期结束后要回公司负责项目上线", previousTravel: "2024年去过日本", companions: "与家人同行", usContact: "酒店", refusalHistory: "从未拒签" };

describe("interview engine", () => {
  it("asks one adaptive follow-up only when core facts are missing", () => {
    const question = getQuestion(profile, 1)!;
    const first = processAnswer({ profile, question, answer: "去玩", questionIndex: 1, followUpUsed: false });
    expect(first.nextQuestion).toMatchObject({ isFollowUp: true, parentId: "itinerary" });
    const second = processAnswer({ profile, question: first.nextQuestion!, answer: "主要去旧金山和洛杉矶，每个城市都有酒店和景点安排。", questionIndex: 1, followUpUsed: true });
    expect(second.nextQuestionIndex).toBe(2);
    expect(second.nextQuestion?.id).toBe("duration");
  });

  it("creates a personalized incomplete-session report", () => {
    const question = getQuestion(profile, 0)!;
    const assessment = processAnswer({ profile, question, answer: "我和家人去美国旅游，计划参观博物馆和国家公园。", questionIndex: 0, followUpUsed: true }).assessment;
    const exchanges: InterviewExchange[] = [{ question, answer: "我和家人去美国旅游，计划参观博物馆和国家公园。", assessment, submittedAt: "2026-08-22T00:00:00.000Z" }];
    const report = createInterviewReport({ profile, exchanges, idempotencyKey: "session-12345678", generatedAt: "2026-08-22T00:00:00.000Z" });
    expect(report.riskFlags).toContain("提前结束：仅完成 1/8 个核心主题");
    expect(report.dimensions.consistency).toBeNull();
    expect(report.dimensions.consistencyStatus).toBe("unverified");
    expect(report.disclaimer).toContain("不预测");
    expect(report.questionAnalysis[0].responseFramework).toContain("真实访问目的");
  });

  it("covers all V1 topics without predicting an outcome", () => {
    const topics = Array.from({ length: 8 }, (_, index) => getQuestion(profile, index)?.topic);
    expect(topics).toEqual([
      "赴美目的",
      "行程安排",
      "停留时间",
      "费用来源",
      "职业或学业",
      "同行人与美国联系人",
      "旅行与拒签记录",
      "回国约束",
    ]);
    expect(getQuestion(profile, 8)).toBeNull();
  });

  it("runs English questions and follow-ups without falling back to Chinese", () => {
    const question = getQuestion(profile, 1, "en-US")!;
    expect(question).toMatchObject({ topic: "Itinerary" });
    expect(question.prompt).toContain("Which cities");

    const followUp = buildFollowUp(profile, question, {
      score: 40,
      status: "weak",
      note: "missing destination",
      missingRequirements: ["destination"],
    }, "en-US");
    expect(followUp?.prompt).toContain("Which city");
    expect(followUp?.prompt).not.toMatch(/[\u3400-\u9fff]/u);

    const next = processAnswer({
      profile,
      question,
      answer: "San Francisco and Los Angeles, with hotels and museums planned in both cities.",
      questionIndex: 1,
      followUpUsed: true,
      language: "en-US",
    });
    expect(next.nextQuestion).toMatchObject({ id: "duration", topic: "Length of stay" });
  });

  it("only verifies consistency when a saved application anchor matches", () => {
    const question = getQuestion(profile, 0)!;
    const linked = processAnswer({
      profile,
      context: { source: "application", applicationId: "application-id", missingFields: [], verifiedFields: ["purposeDetails"] },
      question,
      answer: "我会与家人去美国旅游，并参观博物馆。",
      questionIndex: 0,
      followUpUsed: true,
    });
    expect(linked.assessment.dimensions!.consistencyStatus).toBe("verified");
    expect(linked.assessment.dimensions!.consistency).not.toBeNull();

    const unverifiable = processAnswer({
      profile,
      context: { source: "application", applicationId: "application-id", missingFields: [], verifiedFields: ["purposeDetails"] },
      question,
      answer: "这是一次已有明确安排的短期访问。",
      questionIndex: 0,
      followUpUsed: true,
    });
    expect(unverifiable.assessment.dimensions!.consistencyStatus).toBe("unverified");
    expect(unverifiable.assessment.note).toContain("未核验");
  });
});
