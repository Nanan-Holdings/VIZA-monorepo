import { describe, expect, it } from "vitest";
import { createInterviewReport, getQuestion, processAnswer } from "./engine";
import type { ApplicantProfile, InterviewExchange } from "./types";

const profile: ApplicantProfile = { purpose: "tourism", purposeDetails: "与家人去美国旅游", destinations: "旧金山和洛杉矶", travelDates: "2026年10月", duration: "12天", funding: "本人用工资和存款承担", budget: "3万元人民币", occupation: "产品经理", employer: "VIZA", homeTies: "假期结束后要回公司负责项目上线", previousTravel: "2024年去过日本" };

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
    expect(report.riskFlags).toContain("提前结束：仅完成 1/7 个核心主题");
    expect(report.questionAnalysis[0].responseFramework).toContain("与家人去美国旅游");
  });
});
