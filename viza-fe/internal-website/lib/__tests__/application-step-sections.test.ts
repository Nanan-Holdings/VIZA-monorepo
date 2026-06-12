import { describe, expect, it } from "vitest";
import {
  buildApplicationStepSections,
  getApplicationStepSectionKey,
  type ApplicationStepSectionKey,
  type ApplicationStepRef,
} from "../application-step-sections";

const titles: Record<ApplicationStepSectionKey, string> = {
  personal: "个人信息",
  travel: "行程信息",
  travelCompanions: "同行人员",
  previousTravel: "过往旅行",
  addressAndPhone: "联系信息",
  passport: "护照信息",
  usContact: "美国联系人",
  family: "家庭信息",
  workEducationTraining: "工作/教育",
  securityAndBackground: "安全背景",
  documents: "支持材料",
  photo: "照片",
  review: "审核申请",
  team: "团队",
  confirmation: "确认",
};

function step(id: number, sourceName: string): ApplicationStepRef {
  return {
    id,
    name: sourceName,
    description: "",
    sourceName,
  };
}

describe("application step sections", () => {
  it("classifies Vietnam e-visa source steps without collapsing them into review", () => {
    expect(getApplicationStepSectionKey(step(1, "Required Information"))).toBe("personal");
    expect(getApplicationStepSectionKey(step(2, "Requested Information"))).toBe("travel");
    expect(getApplicationStepSectionKey(step(2, "Contact Information"))).toBe("addressAndPhone");
    expect(getApplicationStepSectionKey(step(3, "Information About the Trip"))).toBe("travel");
    expect(getApplicationStepSectionKey(step(4, "Accompanying Children Under 14"))).toBe("travel");
    expect(getApplicationStepSectionKey(step(5, "Trip Expenses & Insurance"))).toBe("travel");
    expect(getApplicationStepSectionKey(step(6, "Declaration"))).toBe("securityAndBackground");
  });

  it("preserves the source step order while building sidebar sections", () => {
    const sections = buildApplicationStepSections([
      step(0, "Required Information"),
      step(1, "Requested Information"),
      step(2, "Passport Information"),
      step(3, "Contact Information"),
      step(4, "Occupation"),
      step(5, "Information About the Trip"),
      step(6, "Accompanying Children Under 14"),
      step(7, "Trip Expenses & Insurance"),
      step(8, "Declaration"),
      step(9, "Supporting Documents"),
      step(10, "Review"),
    ], titles);

    expect(sections.flatMap((section) => section.steps.map((sectionStep) => sectionStep.id))).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(new Set(sections.map((section) => section.id)).size).toBe(sections.length);
    expect(sections.find((section) => section.key === "review")?.steps.map((sectionStep) => sectionStep.sourceName)).toEqual([
      "Review",
    ]);
  });
});
