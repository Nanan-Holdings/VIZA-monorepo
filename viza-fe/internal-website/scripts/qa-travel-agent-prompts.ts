import {
  parseTravelIntent,
  resolveLocalDestinationText,
} from "../lib/travel/destination-resolver";

type PromptCase = {
  id: number;
  prompt: string;
  expectedCanonicals?: string[];
  ambiguous?: boolean;
  nonDestination?: boolean;
  commandIntent?: boolean;
  expectedIntent?: string;
  typoChangsha?: boolean;
};

const promptCases: PromptCase[] = [
  { id: 1, prompt: "我想去长沙", expectedCanonicals: ["Changsha"] },
  { id: 2, prompt: "我想要去长沙", expectedCanonicals: ["Changsha"] },
  {
    id: 3,
    prompt: "我想要区长沙",
    expectedCanonicals: ["Changsha"],
    typoChangsha: true,
  },
  { id: 4, prompt: "帮我做一个长沙3-5天旅行计划", expectedCanonicals: ["Changsha"] },
  { id: 5, prompt: "长沙三天怎么玩", expectedCanonicals: ["Changsha"] },
  { id: 6, prompt: "想去湖南长沙玩五天", expectedCanonicals: ["Changsha"] },
  { id: 7, prompt: "我想去东京", expectedCanonicals: ["Tokyo"] },
  { id: 8, prompt: "我想去日本东京5天", expectedCanonicals: ["Tokyo"] },
  {
    id: 9,
    prompt: "帮我规划洛杉矶和拉斯维加斯6天",
    expectedCanonicals: ["Los Angeles", "Las Vegas"],
  },
  { id: 10, prompt: "新加坡周末游", expectedCanonicals: ["Singapore"] },
  {
    id: 11,
    prompt: "I want to visit Changsha for 3-5 days",
    expectedCanonicals: ["Changsha"],
  },
  { id: 12, prompt: "Plan a 5 day trip to Tokyo", expectedCanonicals: ["Tokyo"] },
  {
    id: 13,
    prompt: "LA and Las Vegas for 6 days",
    expectedCanonicals: ["Los Angeles", "Las Vegas"],
  },
  { id: 14, prompt: "I want to go to Paris", expectedCanonicals: ["Paris"] },
  { id: 15, prompt: "Singapore weekend trip", expectedCanonicals: ["Singapore"] },
  { id: 16, prompt: "帮我 plan 一个 Tokyo 5 days trip", expectedCanonicals: ["Tokyo"] },
  { id: 17, prompt: "LA 3天怎么玩", expectedCanonicals: ["Los Angeles"] },
  {
    id: 18,
    prompt: "我想去 Changsha 3-5 days",
    expectedCanonicals: ["Changsha"],
  },
  { id: 19, prompt: "我想去长", ambiguous: true },
  { id: 20, prompt: "Springfield 3 days", ambiguous: true },
  { id: 21, prompt: "Georgia travel plan", ambiguous: true },
  { id: 22, prompt: "旅行保险需要买吗", nonDestination: true },
  { id: 23, prompt: "申根签证要准备什么", nonDestination: true },
  { id: 24, prompt: "帮我删除第二天", commandIntent: true },
  { id: 25, prompt: "把伦敦那天换到最后", commandIntent: true },
  { id: 26, prompt: "不要这个", commandIntent: true, expectedIntent: "remove_item" },
  { id: 27, prompt: "这个不要", commandIntent: true, expectedIntent: "remove_item" },
  { id: 28, prompt: "我不喜欢这个景点", commandIntent: true, expectedIntent: "remove_item" },
  { id: 29, prompt: "删掉岳麓山", commandIntent: true, expectedIntent: "remove_item" },
  { id: 30, prompt: "不要博物馆", commandIntent: true, expectedIntent: "remove_item" },
  { id: 31, prompt: "换一个", commandIntent: true, expectedIntent: "clarify_needed" },
  { id: 32, prompt: "这个太远了", commandIntent: true, expectedIntent: "clarify_needed" },
  { id: 33, prompt: "不要这个卡片", commandIntent: true, expectedIntent: "remove_item" },
  { id: 34, prompt: "不要安排购物", commandIntent: true, expectedIntent: "remove_item" },
  { id: 35, prompt: "不想去太商业化的地方", commandIntent: true, expectedIntent: "remove_item" },
  { id: 36, prompt: "你好", nonDestination: true, expectedIntent: "invalid_or_unrelated" },
];

function canonicalNamesForResolution(prompt: string): string[] {
  const resolution = resolveLocalDestinationText(prompt);
  if (resolution.status === "resolved") {
    return resolution.destinations.map((destination) => destination.canonicalName);
  }
  if (resolution.status === "temporary") {
    return [resolution.destination.canonicalName];
  }
  if (resolution.status === "ambiguous") {
    return resolution.options.map((destination) => destination.canonicalName);
  }
  return [];
}

const failures: string[] = [];

for (const item of promptCases) {
  const intent = parseTravelIntent(item.prompt);
  const resolution = resolveLocalDestinationText(item.prompt);
  const canonicalNames = canonicalNamesForResolution(item.prompt);
  const fallbackCardAllowed = resolution.status === "temporary";
  const clarificationNeeded =
    intent.needsClarification || resolution.status === "ambiguous";
  const duration = intent.duration
    ? `${intent.duration.minDays}-${intent.duration.maxDays} days`
    : "-";

  if (item.expectedCanonicals) {
    if (resolution.status !== "resolved") {
      failures.push(`#${item.id} expected resolved, got ${resolution.status}`);
    }

    for (const expected of item.expectedCanonicals) {
      if (!canonicalNames.includes(expected)) {
        failures.push(
          `#${item.id} expected ${expected}, got ${canonicalNames.join(", ") || "-"}`
        );
      }
    }

    if (fallbackCardAllowed) {
      failures.push(`#${item.id} known destination became temporary fallback`);
    }
  }

  if (item.typoChangsha && !canonicalNames.includes("Changsha")) {
    failures.push("#3 typo 区长沙 did not resolve to Changsha");
  }

  if (item.ambiguous) {
    if (!clarificationNeeded || resolution.status !== "ambiguous") {
      failures.push(`#${item.id} ambiguous prompt did not ask clarification`);
    }
    if (fallbackCardAllowed) {
      failures.push(`#${item.id} ambiguous prompt created a fallback card`);
    }
  }

  if (item.nonDestination) {
    if (resolution.status !== "unresolved") {
      failures.push(`#${item.id} non-destination query created destination flow`);
    }
    if (fallbackCardAllowed) {
      failures.push(`#${item.id} non-destination query created fallback card`);
    }
  }

  if (item.commandIntent) {
    if (resolution.status !== "unresolved") {
      failures.push(`#${item.id} command intent was not kept out of destination flow`);
    }
    if (fallbackCardAllowed) {
      failures.push(`#${item.id} command intent created fallback card`);
    }
  }

  if (item.expectedIntent && intent.intent !== item.expectedIntent) {
    failures.push(
      `#${item.id} expected intent ${item.expectedIntent}, got ${intent.intent}`
    );
  }

  if (item.commandIntent || item.nonDestination) {
    if (canonicalNames.length > 0) {
      failures.push(
        `#${item.id} should not create destination entities, got ${canonicalNames.join(", ")}`
      );
    }
  }

  console.log(
    [
      `#${item.id}`,
      item.prompt,
      `intent=${intent.intent}`,
      `destinations=${canonicalNames.join("|") || "-"}`,
      `confidence=${intent.destinations.map((destination) => destination.confidence.toFixed(2)).join("|") || "-"}`,
      `duration=${duration}`,
      `clarification=${clarificationNeeded ? "yes" : "no"}`,
      `fallback_card_allowed=${fallbackCardAllowed ? "yes" : "no"}`,
      `status=${resolution.status}`,
    ].join(" | ")
  );
}

if (failures.length > 0) {
  console.error("\nTravel Agent prompt QA failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log("\nTravel Agent prompt QA passed.");
}
