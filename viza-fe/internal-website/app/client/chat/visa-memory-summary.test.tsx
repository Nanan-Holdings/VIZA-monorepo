import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { VisaChatMemorySnapshot } from "@/app/actions/companion-sessions";
import { VisaMemorySummary } from "./visa-memory-summary";

const translations: Record<string, string> = {
  memoryTitle: "本聊天记忆",
  memoryPassport: "护照",
  memoryResidence: "居住地",
  memoryDestination: "目的地",
  memoryPurpose: "出行目的",
  memoryPurposeTourism: "旅游",
  memoryDays: "天数",
  memoryEdit: "编辑聊天记忆",
};

vi.mock("next-intl", () => ({
  useLocale: () => "zh-CN",
  useTranslations: () => (key: string) => translations[key] ?? key,
}));

const snapshot: VisaChatMemorySnapshot = {
  revision: 3,
  state: {
    destinationCountries: ["switzerland", "singapore", "france"],
    mainDestination: "switzerland",
    nationality: "CHN",
    passportCountryIso3: "CHN",
    passportType: "ordinary",
    residenceCountry: "china",
    residenceCity: null,
    tripPurpose: "tourism",
    stayLengthDays: 10,
    schengenDaySplit: {},
    firstEntryCountry: null,
    recommendedVisaType: null,
    fieldSources: {},
    missingSlots: [],
    confidence: 1,
    updatedAt: "2026-08-04T00:00:00.000Z",
  },
};

describe("VisaMemorySummary", () => {
  it("localizes canonical memory values for the Chinese interface", () => {
    render(
      <VisaMemorySummary
        snapshot={snapshot}
        onClear={vi.fn()}
        onSave={vi.fn()}
        onSavePassport={vi.fn()}
      />
    );

    expect(screen.getByText("护照: 中国")).toBeInTheDocument();
    expect(screen.getByText("居住地: 中国")).toBeInTheDocument();
    expect(screen.getByText("目的地: 瑞士、新加坡、法国")).toBeInTheDocument();
    expect(screen.getByText("出行目的: 旅游")).toBeInTheDocument();
    expect(screen.queryByText(/CHN|switzerland|singapore|france|tourism/)).not.toBeInTheDocument();
  });
});
