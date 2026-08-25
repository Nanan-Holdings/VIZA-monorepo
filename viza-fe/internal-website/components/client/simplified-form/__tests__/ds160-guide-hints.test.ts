import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

function readJson(path: string) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

function readSource(path: string) {
  return readFileSync(join(root, path), "utf8");
}

const zh = readJson("messages/zh.json").simplifiedForm;
const en = readJson("messages/en.json").simplifiedForm;

describe("DS-160 simplified guide hints", () => {
  it("locks high-risk Chinese hints without default-answer guidance", () => {
    expect(zh.identity.firstNameHint).toContain("无名（FNU）");
    expect(zh.passport.bookNumberHelp).toContain("不要把资料页右上角的护照号码重复填入");
    expect(zh.passport.bookNumberHelp).toContain("美国国务院官方只确认护照本号位置会因签发国而异");
    expect(zh.passport.extraSsnHint).toContain("美国社会安全局签发的 9 位号码");
    expect(zh.passport.extraSsnHint).toContain("不要在这里填写美国个人纳税人识别号码");
    expect(zh.passport.extraItinHint).toContain("美国国税局签发的 9 位税务号码");
    expect(zh.passport.extraItinHint).toContain("不要在这里填写美国社会安全号码");
    expect(zh.travel.hasCompanionsHint).toContain("美国国务院官方说明");
    expect(zh.travel.hasCompanionsHint).toContain("不要为了提高面试效果而虚构同行人");
    expect(zh.contact.socialMediaHint).toContain("不要提供密码");
    expect(zh.family.languagesHint).toContain("不要为了旅游签证只写中文");

    const rejectedPhrases = ["一般选择否", "一般是no", "一般填", "加分", "只写中文即可", "填 2-3 个即可"];
    const joinedHints = [
      zh.passport.extraOtherCitizenshipHint,
      zh.passport.extraOtherCountryPermanentResidenceHint,
      zh.travel.hasCompanionsHint,
      zh.contact.socialMediaHint,
      zh.family.languagesHint,
    ].join("\n");
    for (const phrase of rejectedPhrases) {
      expect(joinedHints).not.toContain(phrase);
    }
  });

  it("locks matching English hints for separated SSN, ITIN, companions, and social media", () => {
    expect(en.passport.extraSsnHint).toContain("Social Security Administration");
    expect(en.passport.extraSsnHint).toContain("Do not enter a U.S. taxpayer identification number here");
    expect(en.passport.extraItinHint).toContain("Internal Revenue Service");
    expect(en.passport.extraItinHint).toContain("Do not enter a Social Security Number here");
    expect(en.travel.hasCompanionsHint).toContain("U.S. Department of State DS-160 Travel Companions Help");
    expect(en.contact.socialMediaHint).toContain("Do not provide passwords");
  });

  it("renders approved hints from the relevant simplified form steps", () => {
    const identity = readSource("components/client/simplified-form/step-identity.tsx");
    const passport = readSource("components/client/simplified-form/step-passport.tsx");
    const contact = readSource("components/client/simplified-form/step-contact.tsx");
    const travel = readSource("components/client/simplified-form/step-travel.tsx");
    const usStay = readSource("components/client/simplified-form/step-us-stay.tsx");
    const usContact = readSource("components/client/simplified-form/step-us-contact.tsx");
    const work = readSource("components/client/simplified-form/step-work-education.tsx");

    expect(identity).toContain('hint={t("firstNameHint")}');
    expect(identity).toContain('hint={t("birthPlaceHint")}');
    expect(passport).toContain('hint={t("extraSsnHint")}');
    expect(passport).toContain('t("bookNumberHelp")');
    expect(contact).toContain('hint={t("socialMediaHint")}');
    expect(travel).toContain('hint={t("hasCompanionsHint")}');
    expect(travel).toContain('hint={t("previousRefusalHint")}');
    expect(usStay).toContain('t("usAccommodationTruthHint")');
    expect(usContact).toContain('t("truthfulContactHint")');
    expect(work).toContain('hint={t("primaryOccupationHint")}');
    expect(work).toContain('hint={t("educationCourseHint")}');
  });
});
