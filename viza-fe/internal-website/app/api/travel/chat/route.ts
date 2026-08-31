import { createAdminClient } from "@/lib/supabase/admin";
import { countries } from "country-data-list";
import { getTravelUserSession } from "@/lib/travel/auth";
import {
  applyTravelStateOperations,
  coerceTravelState,
  TRAVEL_STATE_PATHS,
  type TravelStateOperation,
} from "@/lib/travel/conversation-state";
import {
  normalizeDestinationText,
  resolveLocalDestinationText,
  toTravelDestinationChatCard,
  type DestinationResolution,
} from "@/lib/travel/destination-resolver";
import {
  findDropdownDestinationContract,
  getDropdownDestinationContracts,
} from "@/lib/travel/destination-contracts";
import {
  CURATED_CITIES_BY_COUNTRY,
  getCuratedCityLabel,
} from "@/lib/travel/locations";
import type {
  TravelDestinationCard,
  TravelPendingActionPreview,
  TravelQuickReply,
} from "@/lib/travel/chat-types";
import { nextMissingField, type TravelField } from "@/lib/travel/planner";
import type { Json } from "@/types/database";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const TRAVEL_AGENT_MODEL = "gpt-5.6-luna";
const TRAVEL_AGENT_FALLBACK_MODEL = "gpt-5.5";
const TRAVEL_AGENT_OPENAI_TIMEOUT_MS = 60_000;
const MAX_USER_TEXT_LENGTH = 8_000;
let activeTravelAgentModel = TRAVEL_AGENT_MODEL;

type InterfaceLocale = "zh" | "en";
type TravelAgentIntent =
  | "answer_question"
  | "recommend_destinations"
  | "record_facts"
  | "select_destination"
  | "remove_destination"
  | "confirm_action"
  | "reject_action"
  | "generate_itinerary"
  | "modify_itinerary"
  | "clarify";

type TravelAgentUiAction =
  "none" | "collect_field" | "generate_itinerary" | "revise_itinerary";

type TravelAgentModelResult = {
  intent: TravelAgentIntent;
  reply: string;
  operations: TravelStateOperation[];
  recommendations: string[];
  quickReplies: TravelQuickReply[];
  memorySummary: string;
  preferenceUpdates: Array<{
    key:
      | "interests"
      | "pace"
      | "dietary"
      | "accommodation"
      | "transport"
      | "avoid";
    value: string;
    explicit: boolean;
    evidence: string;
  }>;
};

type TravelAgentSessionRow = {
  id: string;
  state_json: Json;
  state_version: number;
  memory_summary: string;
  openai_previous_response_id: string | null;
  pending_actions_json: Json;
};

type TravelChatRequest = {
  sessionId: string;
  messageId: string;
  text: string;
  locale: InterfaceLocale;
  expectedStateVersion: number;
  applicationId: string | null;
};

type OpenAIResponseEnvelope = {
  id?: unknown;
  output_text?: unknown;
  output?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

type PlannerDestinationPath = "countries" | "cities";

type CountryMetadata = {
  name: string;
  alpha2: string;
  alpha3: string;
};

type DestinationLabel = {
  path: PlannerDestinationPath;
  label: string;
  valueEn: string;
  valueZh: string;
};

const COUNTRY_METADATA: CountryMetadata[] = (
  countries.all as unknown[]
).flatMap((item) => {
  if (!isRecord(item)) return [];
  const name = typeof item.name === "string" ? item.name.trim() : "";
  const alpha2 =
    typeof item.alpha2 === "string" ? item.alpha2.trim().toUpperCase() : "";
  const alpha3 =
    typeof item.alpha3 === "string" ? item.alpha3.trim().toUpperCase() : "";
  return name && alpha2 && alpha3 ? [{ name, alpha2, alpha3 }] : [];
});

const ZH_REGION_DISPLAY_NAMES = new Intl.DisplayNames(["zh-CN"], {
  type: "region",
});

function localizedCountryName(
  countryNameEn: string,
  locale: InterfaceLocale
): string {
  if (locale === "en") return countryNameEn;
  const metadata = COUNTRY_METADATA.find(
    (country) =>
      country.name.toLocaleLowerCase() === countryNameEn.toLocaleLowerCase()
  );
  if (!metadata) return countryNameEn;
  try {
    return ZH_REGION_DISPLAY_NAMES.of(metadata.alpha2) ?? countryNameEn;
  } catch {
    return countryNameEn;
  }
}

function countryMetadataForValue(value: string): CountryMetadata | null {
  const normalized = normalizeDestinationText(value);
  if (!normalized) return null;
  return (
    COUNTRY_METADATA.find((country) =>
      [
        country.name,
        country.alpha2,
        country.alpha3,
        localizedCountryName(country.name, "zh"),
      ].some((label) => normalizeDestinationText(label) === normalized)
    ) ?? null
  );
}

function countryLabelsForValue(value: string): string[] {
  const metadata = countryMetadataForValue(value);
  const normalizedValue = normalizeDestinationText(value);
  if (!metadata) return [];
  let localized = "";
  try {
    localized = ZH_REGION_DISPLAY_NAMES.of(metadata.alpha2) ?? "";
  } catch {
    localized = "";
  }
  const labels = [metadata.name, localized];
  // ISO codes remain valid when the operation itself names the exact code,
  // but they are deliberately not aliases for a country name in ordinary
  // prose ("in", "to", "as", and "no" are all valid English words).
  if (
    normalizedValue === normalizeDestinationText(metadata.alpha2) ||
    normalizedValue === normalizeDestinationText(metadata.alpha3)
  ) {
    labels.push(metadata.alpha2, metadata.alpha3);
  }
  return labels.filter((label): label is string => Boolean(label.trim()));
}

function cityCountryMatches(value: string): Array<{
  countryNameEn: string;
  cityEn: string;
  cityZh: string;
}> {
  const normalized = normalizeDestinationText(value);
  if (!normalized) return [];
  const matches: Array<{
    countryNameEn: string;
    cityEn: string;
    cityZh: string;
  }> = [];
  for (const [countryNameEn, cities] of Object.entries(
    CURATED_CITIES_BY_COUNTRY
  )) {
    for (const city of cities) {
      const labels = [city.en, city.zh, ...(city.aliases ?? [])].filter(
        (label): label is string => Boolean(label?.trim())
      );
      if (
        labels.some((label) => normalizeDestinationText(label) === normalized)
      ) {
        matches.push({
          countryNameEn,
          cityEn: city.en,
          cityZh: city.zh ?? city.en,
        });
        break;
      }
    }
  }
  return matches;
}

function isKnownCountryValue(value: string): boolean {
  return Boolean(countryMetadataForValue(value));
}

function isKnownCityValue(value: string): boolean {
  if (findDropdownDestinationContract(value)) return true;
  if (cityCountryMatches(value).length > 0) return true;
  const resolution = resolveLocalDestinationText(value);
  return (
    resolution.status === "resolved" &&
    resolution.destinations.some((destination) => Boolean(destination.city))
  );
}

function localizedCityName(value: string, locale: InterfaceLocale): string {
  const contract = findDropdownDestinationContract(value);
  if (contract) return locale === "zh" ? contract.nameZh : contract.nameEn;

  const curated = getCuratedCityLabel(value, locale);
  if (curated) return curated;

  const resolution = resolveLocalDestinationText(value);
  if (resolution.status === "resolved") {
    const destination = resolution.destinations[0];
    if (destination) {
      return locale === "zh"
        ? (destination.nameZh ?? destination.city ?? destination.displayName)
        : (destination.nameEn ?? destination.city ?? destination.displayName);
    }
  }
  return value.trim();
}

function canonicalDestinationValue(
  path: PlannerDestinationPath,
  value: string
): string {
  if (path === "countries") {
    return (
      countryMetadataForValue(value)?.name ?? normalizeDestinationText(value)
    );
  }
  const city = cityCountryMatches(value)[0];
  if (city) return normalizeDestinationText(city.cityEn);
  const contract = findDropdownDestinationContract(value);
  if (contract) return normalizeDestinationText(contract.nameEn);
  return normalizeDestinationText(value);
}

function destinationLabelRanges(
  text: string,
  label: string
): Array<{ start: number; end: number }> {
  const normalizedText = normalizeDestinationText(text);
  const normalizedLabel = normalizeDestinationText(label);
  if (!normalizedText || !normalizedLabel) return [];

  if (/^[a-z0-9 ]+$/u.test(normalizedLabel)) {
    const escaped = normalizedLabel.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const pattern = new RegExp(
      `(?:^|[^a-z0-9])(${escaped})(?=$|[^a-z0-9])`,
      "gu"
    );
    const ranges: Array<{ start: number; end: number }> = [];
    for (const match of normalizedText.matchAll(pattern)) {
      const value = match[1];
      if (!value || match.index === undefined) continue;
      const start = match.index + match[0].indexOf(value);
      ranges.push({ start, end: start + value.length });
    }
    return ranges;
  }

  const ranges: Array<{ start: number; end: number }> = [];
  let start = normalizedText.indexOf(normalizedLabel);
  while (start >= 0) {
    ranges.push({ start, end: start + normalizedLabel.length });
    start = normalizedText.indexOf(normalizedLabel, start + 1);
  }
  return ranges;
}

function destinationLabels(): DestinationLabel[] {
  const labels = new Map<string, DestinationLabel>();
  const add = (item: DestinationLabel) => {
    const normalized = normalizeDestinationText(item.label);
    if (!normalized) return;
    labels.set(`${item.path}:${normalized}`, item);
  };

  for (const country of COUNTRY_METADATA) {
    const valueZh = localizedCountryName(country.name, "zh");
    [country.name, valueZh].forEach((label) =>
      add({
        path: "countries",
        label,
        valueEn: country.name,
        valueZh,
      })
    );
  }

  for (const [countryNameEn, cities] of Object.entries(
    CURATED_CITIES_BY_COUNTRY
  )) {
    for (const city of cities) {
      const valueZh = city.zh ?? city.en;
      [city.en, valueZh, ...(city.aliases ?? [])].forEach((label) =>
        add({
          path: "cities",
          label,
          valueEn: city.en,
          valueZh,
        })
      );
    }
    // The country key is intentionally included only as a canonical English
    // label. Localized country labels come from COUNTRY_METADATA above.
    add({
      path: "countries",
      label: countryNameEn,
      valueEn: countryNameEn,
      valueZh: localizedCountryName(countryNameEn, "zh"),
    });
  }

  for (const contract of getDropdownDestinationContracts()) {
    [
      contract.nameEn,
      contract.nameZh,
      contract.canonicalName,
      contract.city,
      ...contract.aliases,
    ].forEach((label) =>
      add({
        path: "cities",
        label,
        valueEn: contract.nameEn,
        valueZh: contract.nameZh,
      })
    );
    [contract.countryNameEn, contract.countryNameZh].forEach((label) =>
      add({
        path: "countries",
        label,
        valueEn: contract.countryNameEn,
        valueZh: contract.countryNameZh,
      })
    );
  }

  return [...labels.values()];
}

const DESTINATION_LABELS = destinationLabels();

function destinationFactClauses(text: string): string[] {
  return text
    .split(
      /(?:[，,；;。.!！\n]+|(?:但是|但|不过|然而)|\b(?:but|however|while)\b)/iu
    )
    .map((clause) => clause.trim())
    .filter(Boolean);
}

function isNonFactDestinationClause(clause: string): boolean {
  return (
    isExplicitDestinationRemovalClause(clause) ||
    DESTINATION_HYPOTHETICAL_PATTERN.test(clause) ||
    DESTINATION_QUESTION_PATTERN.test(clause) ||
    /(?:推荐|建议|介绍|展示|列出|recommend|suggest|alternative|other)/iu.test(
      clause
    )
  );
}

function knownDestinationOperations(
  text: string,
  evidence: string,
  locale: InterfaceLocale,
  preferCitiesForItinerary = false
): TravelStateOperation[] {
  const clauses = destinationFactClauses(text).filter(
    (clause) => !isNonFactDestinationClause(clause)
  );
  const operations: TravelStateOperation[] = [];
  const seen = new Set<string>();
  for (const clause of clauses) {
    const matches = DESTINATION_LABELS.flatMap((label) =>
      destinationLabelRanges(clause, label.label).map((range) => ({
        ...range,
        label,
      }))
    );
    const nonContainedMatches = matches.filter(
      (match) =>
        !matches.some(
          (other) =>
            other !== match &&
            other.label.path === match.label.path &&
            other.start <= match.start &&
            other.end >= match.end &&
            other.end - other.start > match.end - match.start
        )
    );

    for (const { label } of nonContainedMatches) {
      const path =
        label.path === "countries" && preferCitiesForItinerary
          ? "cities"
          : label.path;
      const valueText = locale === "zh" ? label.valueZh : label.valueEn;
      const key = `${path}:${canonicalDestinationValue(path, valueText)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      operations.push({
        op: "add",
        path,
        valueText,
        valueNumber: null,
        valueBoolean: null,
        explicit: true,
        evidence,
      });
    }
  }
  return operations;
}

function countryForCuratedCity(
  value: string,
  locale: InterfaceLocale
): string | null {
  const matches = cityCountryMatches(value);
  const countryNames = [
    ...new Set(matches.map((match) => match.countryNameEn)),
  ];
  if (countryNames.length !== 1) return null;
  return localizedCountryName(countryNames[0], locale);
}

function countryForResolvedCity(
  resolution: DestinationResolution,
  locale: InterfaceLocale
): string | null {
  if (resolution.status !== "resolved") return null;
  const destinations = resolution.destinations.filter(
    (destination) =>
      Boolean(destination.city) &&
      Boolean(destination.countryNameEn ?? destination.countryName)
  );
  const countryKeys = [
    ...new Set(
      destinations.map(
        (destination) =>
          destination.countryCode ??
          destination.countryNameEn ??
          destination.countryName ??
          ""
      )
    ),
  ].filter(Boolean);
  if (countryKeys.length !== 1 || !destinations.length) return null;
  const destination = destinations[0];
  const english =
    destination.countryNameEn ?? destination.countryName ?? countryKeys[0];
  return locale === "zh"
    ? (destination.countryNameZh ?? localizedCountryName(english, locale))
    : (destination.countryNameEn ?? destination.countryName ?? english);
}

function uniqueCountryForCity(
  value: string,
  locale: InterfaceLocale
): string | null {
  return (
    countryForCuratedCity(value, locale) ??
    countryForResolvedCity(resolveLocalDestinationText(value), locale)
  );
}

function destinationPathForValue(
  value: string,
  preferCitiesForItinerary = false
): PlannerDestinationPath | null {
  const knownCountry = isKnownCountryValue(value);
  const knownCity = isKnownCityValue(value);
  if (knownCountry && !knownCity) return "countries";
  if (knownCity && !knownCountry) return "cities";
  if (knownCountry && knownCity) return "countries";
  // An unresolved one-word destination must not silently become a country.
  // Only a selected-country itinerary may safely treat an unknown value as a
  // city; otherwise leave it for the model/UI to clarify.
  return preferCitiesForItinerary ? "cities" : null;
}

function isBroadDestinationCandidate(value: string): boolean {
  const normalized = value.trim();
  return /^(?:一个|某个|某座|任何|随便|不确定|不知道|哪里|哪儿|某地|任意(?:地方|城市|国家)?|anywhere|somewhere|any\s+(?:city|country|place)|a\s+(?:city|country|place))(?:\s|$)/iu.test(
    normalized
  );
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function parseRequest(value: unknown): TravelChatRequest | null {
  if (!isRecord(value)) return null;
  const sessionId =
    typeof value.sessionId === "string" ? value.sessionId.trim() : "";
  const messageId =
    typeof value.messageId === "string" ? value.messageId.trim() : "";
  const text = typeof value.text === "string" ? value.text.trim() : "";
  const expectedStateVersion =
    typeof value.expectedStateVersion === "number" &&
    Number.isInteger(value.expectedStateVersion) &&
    value.expectedStateVersion >= 0
      ? value.expectedStateVersion
      : null;

  if (
    !sessionId ||
    sessionId.length > 160 ||
    !messageId ||
    messageId.length > 160 ||
    !text ||
    text.length > MAX_USER_TEXT_LENGTH ||
    expectedStateVersion === null
  ) {
    return null;
  }

  return {
    sessionId,
    messageId,
    text,
    locale: value.locale === "en" ? "en" : "zh",
    expectedStateVersion,
    applicationId:
      typeof value.applicationId === "string" && value.applicationId.trim()
        ? value.applicationId.trim()
        : null,
  };
}

function extractOpenAIText(payload: OpenAIResponseEnvelope): string {
  if (typeof payload.output_text === "string") return payload.output_text;
  if (!Array.isArray(payload.output)) return "";
  return payload.output
    .flatMap((item) => {
      if (!isRecord(item) || !Array.isArray(item.content)) return [];
      return item.content.flatMap((content) => {
        if (!isRecord(content)) return [];
        return typeof content.text === "string" ? [content.text] : [];
      });
    })
    .join("")
    .trim();
}

function parseOperation(value: unknown): TravelStateOperation | null {
  if (!isRecord(value)) return null;
  const validOps = new Set(["set", "add", "remove", "unset", "reset"]);
  const validPaths = new Set<string>([...TRAVEL_STATE_PATHS, "trip"]);
  if (
    typeof value.op !== "string" ||
    !validOps.has(value.op) ||
    typeof value.path !== "string" ||
    !validPaths.has(value.path) ||
    typeof value.explicit !== "boolean" ||
    typeof value.evidence !== "string"
  ) {
    return null;
  }
  return {
    op: value.op as TravelStateOperation["op"],
    path: value.path as TravelStateOperation["path"],
    valueText:
      typeof value.value_text === "string" ? value.value_text.trim() : null,
    valueNumber:
      typeof value.value_number === "number" &&
      Number.isFinite(value.value_number)
        ? value.value_number
        : null,
    valueBoolean:
      typeof value.value_boolean === "boolean" ? value.value_boolean : null,
    explicit: value.explicit,
    evidence: value.evidence.trim(),
  };
}

function parseModelResult(value: unknown): TravelAgentModelResult | null {
  if (!isRecord(value)) return null;
  const intents = new Set<TravelAgentIntent>([
    "answer_question",
    "recommend_destinations",
    "record_facts",
    "select_destination",
    "remove_destination",
    "confirm_action",
    "reject_action",
    "generate_itinerary",
    "modify_itinerary",
    "clarify",
  ]);
  if (
    typeof value.intent !== "string" ||
    !intents.has(value.intent as TravelAgentIntent) ||
    typeof value.reply !== "string" ||
    !value.reply.trim() ||
    typeof value.memory_summary !== "string" ||
    !Array.isArray(value.operations) ||
    !Array.isArray(value.recommendations) ||
    !Array.isArray(value.quick_replies) ||
    !Array.isArray(value.preference_updates)
  ) {
    return null;
  }

  const operations = value.operations.map(parseOperation);
  if (operations.some((operation) => operation === null)) return null;
  const recommendations = value.recommendations.filter(
    (item): item is string => typeof item === "string" && Boolean(item.trim())
  );
  const quickReplies = value.quick_replies.flatMap((item) => {
    if (
      !isRecord(item) ||
      typeof item.label !== "string" ||
      typeof item.value !== "string" ||
      !item.label.trim() ||
      !item.value.trim()
    ) {
      return [];
    }
    return [{ label: item.label.trim(), value: item.value.trim() }];
  });

  return {
    intent: value.intent as TravelAgentIntent,
    reply: value.reply.trim(),
    operations: operations as TravelStateOperation[],
    recommendations: recommendations.slice(0, 2),
    quickReplies: quickReplies.slice(0, 4),
    memorySummary: value.memory_summary.trim().slice(0, 4_000),
    preferenceUpdates: value.preference_updates.flatMap((item) => {
      const keys = [
        "interests",
        "pace",
        "dietary",
        "accommodation",
        "transport",
        "avoid",
      ];
      if (
        !isRecord(item) ||
        typeof item.key !== "string" ||
        !keys.includes(item.key) ||
        typeof item.value !== "string" ||
        !item.value.trim() ||
        typeof item.explicit !== "boolean" ||
        typeof item.evidence !== "string"
      ) {
        return [];
      }
      return [
        {
          key: item.key as TravelAgentModelResult["preferenceUpdates"][number]["key"],
          value: item.value.trim().slice(0, 500),
          explicit: item.explicit,
          evidence: item.evidence.trim(),
        },
      ];
    }),
  };
}

function outputSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "intent",
      "reply",
      "operations",
      "recommendations",
      "quick_replies",
      "memory_summary",
      "preference_updates",
    ],
    properties: {
      intent: {
        type: "string",
        enum: [
          "answer_question",
          "recommend_destinations",
          "record_facts",
          "select_destination",
          "remove_destination",
          "confirm_action",
          "reject_action",
          "generate_itinerary",
          "modify_itinerary",
          "clarify",
        ],
      },
      reply: { type: "string" },
      operations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "op",
            "path",
            "value_text",
            "value_number",
            "value_boolean",
            "explicit",
            "evidence",
          ],
          properties: {
            op: {
              type: "string",
              enum: ["set", "add", "remove", "unset", "reset"],
            },
            path: {
              type: "string",
              enum: [...TRAVEL_STATE_PATHS, "trip"],
            },
            value_text: { type: ["string", "null"] },
            value_number: { type: ["number", "null"] },
            value_boolean: { type: ["boolean", "null"] },
            explicit: { type: "boolean" },
            evidence: { type: "string" },
          },
        },
      },
      recommendations: {
        type: "array",
        maxItems: 2,
        items: { type: "string" },
      },
      quick_replies: {
        type: "array",
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "value"],
          properties: {
            label: { type: "string" },
            value: { type: "string" },
          },
        },
      },
      memory_summary: { type: "string" },
      preference_updates: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["key", "value", "explicit", "evidence"],
          properties: {
            key: {
              type: "string",
              enum: [
                "interests",
                "pace",
                "dietary",
                "accommodation",
                "transport",
                "avoid",
              ],
            },
            value: { type: "string" },
            explicit: { type: "boolean" },
            evidence: { type: "string" },
          },
        },
      },
    },
  };
}

function systemPrompt(locale: InterfaceLocale): string {
  return [
    "You are VIZA's Travel Advisor and the only intent coordinator for every user utterance.",
    `Reply in ${locale === "zh" ? "natural Simplified Chinese" : "natural English"}.`,
    locale === "zh"
      ? "Every user-facing sentence, question, recommendation, quick reply, country name, and city name must be Chinese. Use established Chinese place names (for example 洛杉矶, not Los Angeles); retain foreign text only when it is an official proper name with no normal Chinese translation."
      : "Keep every user-facing field in English unless an official proper name has no English form.",
    "Sound warm, calm, concise, and human. Answer the user's real question first. Ask at most one essential follow-up question.",
    "Never mention schemas, state machines, payloads, enrichment, model calls, databases, or internal tools.",
    "Use the full conversation context. Resolve short replies such as '没有' and '推荐一下' against the immediately preceding question.",
    "Recommendations are display-only. If the user says they do not know where to go, recommend options but emit NO destination operation.",
    "When recommending destinations, return exactly two distinct options.",
    "Only emit an explicit=true operation when the user directly stated that fact or command in this turn.",
    "A direct command such as '我想去东京' selects Tokyo. A direct command such as '我不要去东京' removes Tokyo.",
    "Questions such as '多少预算合适' and requests such as '推荐一下预算' are advice requests: answer them and emit NO budget operation.",
    "When the user explicitly asks you to create, arrange, generate, or show an itinerary, use intent generate_itinerary. Do not recommend a new destination when the current state already has one.",
    "The UI will collect the next required field after your answer. Do not append a second unrelated follow-up question when you are recording facts or requesting an itinerary.",
    "If you infer a potentially useful change, emit it with explicit=false so it can wait for confirmation. Never claim it was applied.",
    "Use add/remove for cities and countries; set for scalar facts; unset to clear one fact; reset only when the user explicitly asks to restart everything.",
    "For travel_order, use set with value_text containing every selected city in order, separated by Chinese commas. Set final_note to an empty string when the user explicitly says there are no extra notes.",
    "Do not create a destination from a full sentence, a question, or a broad region. Put display suggestions in recommendations.",
    "Keep memory_summary to a compact factual summary of the conversation. Do not store secrets or speculative facts.",
    "Only put a stable preference in preference_updates when the user explicitly states it this turn. Supported preferences are interests, pace, dietary needs, accommodation, transport, and things to avoid.",
  ].join("\n");
}

async function callOpenAI(args: {
  text: string;
  locale: InterfaceLocale;
  state: unknown;
  memorySummary: string;
  preferences: unknown;
  pendingActions: TravelStateOperation[];
  previousResponseId: string | null;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<{ id: string; result: TravelAgentModelResult }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OpenAI is not configured.");

  const context = JSON.stringify({
    current_travel_state: args.state,
    conversation_summary: args.memorySummary,
    saved_preferences: args.preferences,
    pending_confirmation_actions: args.pendingActions,
  });
  const input: Array<{
    role: "developer" | "user" | "assistant";
    content: string;
  }> = [
    { role: "developer", content: systemPrompt(args.locale) },
    { role: "developer", content: `Current server context:\n${context}` },
  ];
  if (!args.previousResponseId) {
    input.push(...args.history.slice(-12));
  }
  input.push({ role: "user", content: args.text });

  const requestModel = (model: string) =>
    fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        previous_response_id: args.previousResponseId ?? undefined,
        reasoning: { effort: "medium" },
        input,
        text: {
          format: {
            type: "json_schema",
            name: "travel_agent_turn",
            strict: true,
            schema: outputSchema(),
          },
        },
      }),
      signal: AbortSignal.timeout(
        Number.parseInt(process.env.TRAVEL_AGENT_OPENAI_TIMEOUT_MS ?? "", 10) ||
          TRAVEL_AGENT_OPENAI_TIMEOUT_MS
      ),
    });

  let response = await requestModel(activeTravelAgentModel);
  if (!response.ok && activeTravelAgentModel === TRAVEL_AGENT_MODEL) {
    const primaryDetail = await response.text();
    if (
      (response.status === 403 || response.status === 404) &&
      primaryDetail.includes("model_not_found")
    ) {
      activeTravelAgentModel =
        process.env.TRAVEL_AGENT_OPENAI_FALLBACK_MODEL?.trim() ||
        TRAVEL_AGENT_FALLBACK_MODEL;
      response = await requestModel(activeTravelAgentModel);
    } else {
      throw new Error(
        `OpenAI ${response.status}: ${primaryDetail.slice(0, 1_000)}`
      );
    }
  }
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1_000);
    throw new Error(`OpenAI ${response.status}: ${detail}`);
  }
  const envelope = (await response.json()) as OpenAIResponseEnvelope;
  const id = typeof envelope.id === "string" ? envelope.id : "";
  const outputText = extractOpenAIText(envelope);
  if (!id || !outputText) {
    throw new Error("OpenAI returned no structured output.");
  }
  try {
    const result = parseModelResult(JSON.parse(outputText) as unknown);
    if (!result) throw new Error("OpenAI output did not match the protocol.");
    return { id, result };
  } catch {
    throw new Error("OpenAI returned invalid structured output.");
  }
}

function explicitDestinationCommand(
  text: string,
  operation: TravelStateOperation,
  intent: TravelAgentIntent,
  pendingActions: TravelStateOperation[]
): boolean {
  if (intent === "confirm_action") {
    return pendingActions.some(
      (pending) =>
        pending.op === operation.op &&
        pending.path === operation.path &&
        pending.valueText?.toLocaleLowerCase() ===
          operation.valueText?.toLocaleLowerCase()
    );
  }
  const value = operation.valueText?.trim();
  if (
    !value ||
    !textMentionsDestination(text, value, operation.path === "countries")
  ) {
    return false;
  }
  if (
    operation.path === "countries" &&
    !isKnownCountryValue(value) &&
    isKnownCityValue(value)
  ) {
    return false;
  }
  if (
    operation.path === "cities" &&
    isKnownCountryValue(value) &&
    !isKnownCityValue(value)
  ) {
    return false;
  }
  if (operation.op === "add") {
    if (
      textExplicitlyRemovesDestination(text, value, operation.path === "cities")
    ) {
      return false;
    }
    return /(?:我想去|我要去|想去|加入|添加|选择|选|就去|改去|换成|回到|还是|决定去|目的地|\d+\s*(?:个)?人[^。！？]*去|i\s+want\s+to|go\s+to|travel\s+to|visit|select|choose|add|include|switch\s+to|destination)/iu.test(
      text
    );
  }
  if (operation.op === "remove") {
    return textExplicitlyRemovesDestination(
      text,
      value,
      operation.path === "cities"
    );
  }
  return false;
}

const EXPLICIT_DESTINATION_REMOVAL_PATTERN =
  /(?:不想去|不愿(?:意)?去|不去|不要去|别去|删除|删掉|移除|取消|撤销|去掉|换掉|不要(?:了|啦)|不要(?=\s*(?:把|将)?[A-Za-z\u3400-\u9fff])|\b(?:do not|don't|dont)\s+(?:want\b|go\s+to\b|visit\b)|\b(?:remove|delete|drop|cancel)\b)/iu;
const DESTINATION_REMOVAL_DOUBLE_NEGATIVE_PATTERN =
  /(?:(?:不是|并非|并不是|没有|没|未必|不一定)\s*(?:不想去|不愿(?:意)?去|不去|不要(?:去)?|不考虑|删除|删掉|移除|去掉)|(?:不想|不要|不愿|不能|不可以)\s*不去|\b(?:not|never)\s+(?:that\s+)?(?:i\s+)?(?:do\s+not|don't|dont)\s+(?:want|go|visit)|\b(?:do\s+not|don't|dont)\s+not\s+(?:want|go|visit|remove|delete)\b)/iu;
const DESTINATION_NEGATED_REMOVAL_ACTION_PATTERN =
  /(?:不要|别|不想|不愿(?:意)?|不希望|\b(?:not|don't|do\s+not)\b)\s*(?:把|将)?[^，,；;。.!！？?\n]{0,24}?(?:删除|删掉|移除|去掉|取消|换掉|\b(?:remove|delete|drop|cancel)\b)/iu;
const DESTINATION_NON_MUTATING_SUGGESTION_PATTERN =
  /(?:不要|别)\s*(?:推荐|建议|介绍|展示|列出|recommend|suggest)/iu;
const DESTINATION_HYPOTHETICAL_PATTERN =
  /^(?:如果|假如|要是|若是|万一|假设|if|whether|in\s+case)(?:\s|$)/iu;
const DESTINATION_QUESTION_PATTERN =
  /(?:吗|是否|是不是|会不会|能不能|可以不可以)\s*[?？]?$|(?:值得|适合|好不好|怎么样|如何|推荐|建议)[^。.!！？?]*[?？]$|^(?!(?:can|could|would)\s+(?:you|i)\s+(?:plan|create|make|build|arrange|organize|show|generate)\b)(?:what|which|where|why|how|should|would|is|are|do|does|could|can)\b|^(?:i\s+wonder|do\s+i\s+need|is\s+it)\b|\b(?:good|worth|suitable|recommended)\b[^.!?]*[?]$/iu;

function isExplicitDestinationRemovalClause(clause: string): boolean {
  if (!EXPLICIT_DESTINATION_REMOVAL_PATTERN.test(clause)) return false;
  return !(
    DESTINATION_REMOVAL_DOUBLE_NEGATIVE_PATTERN.test(clause) ||
    DESTINATION_NEGATED_REMOVAL_ACTION_PATTERN.test(clause) ||
    DESTINATION_NON_MUTATING_SUGGESTION_PATTERN.test(clause) ||
    DESTINATION_HYPOTHETICAL_PATTERN.test(clause) ||
    DESTINATION_QUESTION_PATTERN.test(clause)
  );
}

function destinationMentionLabels(
  value: string,
  includeCountryLabels = false
): string[] {
  const labels = new Set([value]);
  if (includeCountryLabels) {
    countryLabelsForValue(value).forEach((label) => labels.add(label));
  }
  const contract = findDropdownDestinationContract(value);
  if (contract) {
    [
      contract.canonicalName,
      contract.nameEn,
      contract.nameZh,
      contract.city,
      ...contract.aliases,
      ...(includeCountryLabels
        ? [contract.countryNameEn, contract.countryNameZh]
        : []),
    ].forEach((label) => {
      if (label?.trim()) labels.add(label.trim());
    });
  }
  const resolution = resolveLocalDestinationText(value);
  if (resolution.status !== "resolved") return [...labels];

  for (const destination of resolution.destinations) {
    [
      destination.canonicalName,
      destination.displayName,
      destination.nameEn,
      destination.nameZh,
      destination.city,
      ...(destination.aliases ?? []),
      ...(includeCountryLabels
        ? [
            destination.countryName,
            destination.countryNameEn,
            destination.countryNameZh,
          ]
        : []),
    ].forEach((label) => {
      if (label?.trim()) labels.add(label.trim());
    });
  }
  return [...labels];
}

function textMentionsDestination(
  text: string,
  value: string,
  includeCountryLabels = false
): boolean {
  const normalizedText = text.normalize("NFKC").toLocaleLowerCase();
  return destinationMentionLabels(value, includeCountryLabels).some((label) => {
    const normalizedLabel = label.normalize("NFKC").trim().toLocaleLowerCase();
    if (!normalizedLabel) return false;
    if (/^[a-z0-9]{1,3}$/u.test(normalizedLabel)) {
      const escaped = normalizedLabel.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "u").test(
        normalizedText
      );
    }
    return normalizedText.includes(normalizedLabel);
  });
}

function textExplicitlyRemovesDestination(
  text: string,
  value: string,
  includeCountryLabels = false
): boolean {
  return text
    .split(
      /(?:[，,；;。.!！\n]+|(?:但是|但|不过|然而)|\b(?:but|however|while)\b)/iu
    )
    .map((clause) => clause.trim())
    .filter(Boolean)
    .some(
      (clause) =>
        isExplicitDestinationRemovalClause(clause) &&
        textMentionsDestination(clause, value, includeCountryLabels)
    );
}

function reconcileExplicitDestinationRemovals(
  text: string,
  currentState: unknown,
  operations: TravelStateOperation[]
): TravelStateOperation[] {
  if (
    !EXPLICIT_DESTINATION_REMOVAL_PATTERN.test(text) ||
    !text
      .split(
        /(?:[，,；;。.!！\n]+|(?:但是|但|不过|然而)|\b(?:but|however|while)\b)/iu
      )
      .some((clause) => isExplicitDestinationRemovalClause(clause))
  ) {
    return operations;
  }

  const state = coerceTravelState(currentState);
  const selectedDestinations: Array<{
    path: "cities" | "countries";
    value: string;
  }> = [
    ...state.cities.map((value) => ({ path: "cities" as const, value })),
    ...state.countries.map((value) => ({ path: "countries" as const, value })),
  ];
  const additions = selectedDestinations.flatMap(({ path, value }) => {
    if (!textExplicitlyRemovesDestination(text, value, path === "cities")) {
      return [];
    }
    const alreadyRemoved = operations.some(
      (operation) =>
        operation.explicit &&
        operation.op === "remove" &&
        operation.path === path &&
        operation.valueText?.toLocaleLowerCase() === value.toLocaleLowerCase()
    );
    if (alreadyRemoved) return [];
    return [
      {
        op: "remove" as const,
        path,
        valueText: value,
        valueNumber: null,
        valueBoolean: null,
        explicit: true,
        evidence: text,
      },
    ];
  });

  return additions.length ? [...operations, ...additions] : operations;
}

function extractExplicitDepartureDate(text: string): string | null {
  const trimmed = text.trim();
  const shortDate = trimmed.match(
    /^(?:(?:今天|明天|后天|大后天)|(?:(?:本|这|下|下下)周[一二三四五六日天末]?)|(?:(?:本|这|下|下下)个月)|(?:\d{1,2}月\d{1,2}(?:日|号))|(?:\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}(?:日)?))(?:出发)?$/u
  )?.[0];
  if (shortDate) return shortDate.replace(/出发$/u, "").trim();

  const explicitChinese = trimmed.match(
    /(?:出发|启程)(?:时间|日期)?(?:就)?(?:定在|定为|安排在|是|为|[:：])?\s*([^，,；;。.!！？?]{2,30})/u
  )?.[1];
  if (explicitChinese) return explicitChinese.trim();

  const explicitEnglish = trimmed.match(
    /\b(?:departure(?:\s+date)?|depart|leave|leaving)\s*(?:is|on|will\s+be|:)?\s*([^,.!?]{2,40})/iu
  )?.[1];
  return explicitEnglish?.trim() || null;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function resolveExplicitDepartureDate(
  value: string,
  now = new Date()
): string | null {
  const normalized = value.trim();
  const isoMatch = normalized.match(
    /^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})(?:日)?$/u
  );
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day))
    );
    return Number.isNaN(date.getTime()) ? null : toIsoDate(date);
  }

  const monthDayMatch = normalized.match(/^(\d{1,2})月(\d{1,2})(?:日|号)$/u);
  if (monthDayMatch) {
    const [, month, day] = monthDayMatch;
    let year = now.getUTCFullYear();
    let date = new Date(Date.UTC(year, Number(month) - 1, Number(day)));
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    if (date < today) {
      year += 1;
      date = new Date(Date.UTC(year, Number(month) - 1, Number(day)));
    }
    return Number.isNaN(date.getTime()) ? null : toIsoDate(date);
  }

  const relativeDayOffsets: Record<string, number> = {
    今天: 0,
    明天: 1,
    后天: 2,
    大后天: 3,
  };
  if (normalized in relativeDayOffsets) {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    date.setUTCDate(date.getUTCDate() + relativeDayOffsets[normalized]);
    return toIsoDate(date);
  }

  const weekMatch = normalized.match(
    /^(本|这|下|下下)周([一二三四五六日天末])?$/u
  );
  if (weekMatch) {
    const [, weekPrefix, weekdayText] = weekMatch;
    const currentDay = now.getUTCDay() || 7;
    const monday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    monday.setUTCDate(monday.getUTCDate() - currentDay + 1);
    const weekOffset = weekPrefix === "下下" ? 2 : weekPrefix === "下" ? 1 : 0;
    const weekdayOffsets: Record<string, number> = {
      一: 0,
      二: 1,
      三: 2,
      四: 3,
      五: 4,
      六: 5,
      日: 6,
      天: 6,
      末: 5,
    };
    monday.setUTCDate(
      monday.getUTCDate() +
        weekOffset * 7 +
        (weekdayText ? weekdayOffsets[weekdayText] : 0)
    );
    return toIsoDate(monday);
  }

  return null;
}

function reconcileExplicitDepartureDate(
  text: string,
  operations: TravelStateOperation[]
): TravelStateOperation[] {
  const departureDateText = extractExplicitDepartureDate(text);
  if (!departureDateText) return operations;
  const departureDate =
    resolveExplicitDepartureDate(departureDateText) ?? departureDateText;
  const normalizedOperations = operations.map((operation) => {
    if (
      operation.explicit &&
      operation.op === "set" &&
      operation.path === "departure_date"
    ) {
      return { ...operation, valueText: departureDate };
    }
    if (
      operation.explicit &&
      operation.op === "set" &&
      operation.path === "date_flexibility"
    ) {
      return { ...operation, valueText: "fixed" };
    }
    return operation;
  });
  const alreadyRecorded = normalizedOperations.some(
    (operation) =>
      operation.explicit &&
      operation.op === "set" &&
      operation.path === "departure_date"
  );
  const withDepartureDate = alreadyRecorded
    ? normalizedOperations
    : [
        ...normalizedOperations,
        {
          op: "set" as const,
          path: "departure_date" as const,
          valueText: departureDate,
          valueNumber: null,
          valueBoolean: null,
          explicit: true,
          evidence: text,
        },
      ];
  const alreadyFixed = withDepartureDate.some(
    (operation) =>
      operation.explicit &&
      operation.op === "set" &&
      operation.path === "date_flexibility"
  );
  if (alreadyFixed) return withDepartureDate;
  return [
    ...withDepartureDate,
    {
      op: "set",
      path: "date_flexibility",
      valueText: "fixed",
      valueNumber: null,
      valueBoolean: null,
      explicit: true,
      evidence: text,
    },
  ];
}

function validateExplicitOperations(
  text: string,
  intent: TravelAgentIntent,
  operations: TravelStateOperation[],
  pendingActions: TravelStateOperation[]
): TravelStateOperation[] {
  return operations.map((operation) => {
    if (!operation.explicit) return operation;
    if (operation.path === "cities" || operation.path === "countries") {
      return {
        ...operation,
        explicit: explicitDestinationCommand(
          text,
          operation,
          intent,
          pendingActions
        ),
      };
    }
    if (operation.path === "budget") {
      return {
        ...operation,
        explicit:
          /\d/u.test(text) &&
          /(预算|花费|费用|rmb|人民币|元|budget|cost)/iu.test(text),
      };
    }
    if (operation.path === "travel_days") {
      return {
        ...operation,
        explicit: /\d+\s*(天|日|day)/iu.test(text),
      };
    }
    if (operation.path === "travelers") {
      return {
        ...operation,
        explicit: /\d+\s*(?:个\s*)?(人|位|traveler|people|person)/iu.test(text),
      };
    }
    if (operation.path === "travel_order") {
      const mentioned = (operation.valueText ?? "")
        .split(/\s*(?:、|,|，|->|→|再到|然后到|再|然后)\s*/u)
        .filter(Boolean);
      return {
        ...operation,
        explicit:
          mentioned.length > 0 &&
          mentioned.every((city) => text.includes(city)),
      };
    }
    return {
      ...operation,
      explicit:
        intent === "confirm_action" ||
        (Boolean(operation.evidence) && text.includes(operation.evidence)),
    };
  });
}

function resolvePendingDecisionIntent(
  text: string,
  modelIntent: TravelAgentIntent,
  pendingActions: TravelStateOperation[]
): TravelAgentIntent {
  if (!pendingActions.length) return modelIntent;

  const normalized = text.trim();
  if (
    /^(?:确认|确定|同意|接受|应用|确认这些更改|就按这个|好的|可以|没问题|yes|confirm(?: these changes)?|apply(?: these changes)?|accept|ok|okay)(?:[。.!！])?$/iu.test(
      normalized
    )
  ) {
    return "confirm_action";
  }
  if (
    /^(?:取消|拒绝|不要|不接受|放弃|算了|取消这些更改|no|reject|cancel(?: these changes)?|decline)(?:[。.!！])?$/iu.test(
      normalized
    )
  ) {
    return "reject_action";
  }
  return modelIntent;
}

function parseExplicitDepartureDate(text: string): string | null {
  const match = text.match(
    /(?:^|\D)(\d{4})\s*(?:-|\/|\.|年)\s*(\d{1,2})\s*(?:-|\/|\.|月)\s*(\d{1,2})(?:\s*日)?(?:\D|$)/u
  );
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

/**
 * Planner cards submit visible natural-language user messages through the same
 * OpenAI coordinator as free text. Date values in those messages are also
 * normalized deterministically after the model call so harmless formatting
 * differences in model evidence (2026-10-05 vs 2026年10月5日) cannot turn an
 * explicit card confirmation into an uncommitted pending action.
 */
function stabilizeExplicitDateOperations(
  text: string,
  operations: TravelStateOperation[]
): TravelStateOperation[] {
  const explicitlySetsDate =
    /(?:出行|出发|启程)日期\s*(?:先按|是|为|设为|定在)|灵活出行|(?:departure|travel|start)\s+date\s*(?:is|to|as)|(?:depart|leave)\s+on/iu.test(
      text
    );
  const departureDate = explicitlySetsDate
    ? parseExplicitDepartureDate(text)
    : null;
  if (!departureDate) return operations;

  const flexibility = /灵活出行|日期[^。！？]{0,16}灵活|flexible/iu.test(text)
    ? "flexible"
    : /指定日期|固定日期|date\s*(?:is|to|as)|depart|leave/iu.test(text)
      ? "fixed"
      : null;
  const next = operations.filter(
    (operation) =>
      operation.path !== "departure_date" &&
      (flexibility === null || operation.path !== "date_flexibility")
  );
  next.push({
    op: "set",
    path: "departure_date",
    valueText: departureDate,
    valueNumber: null,
    valueBoolean: null,
    explicit: true,
    evidence: departureDate,
  });
  if (flexibility) {
    next.push({
      op: "set",
      path: "date_flexibility",
      valueText: flexibility,
      valueNumber: null,
      valueBoolean: null,
      explicit: true,
      evidence: flexibility === "flexible" ? "灵活出行" : departureDate,
    });
  }
  return next;
}

function stabilizeExplicitEndpointOperations(
  text: string,
  operations: TravelStateOperation[]
): TravelStateOperation[] {
  const explicitPair = text.match(
    /出发地(?:设为|：)\s*([^｜；。]+)｜([^；。]+)；\s*返程地(?:设为|：)\s*([^｜；。]+)｜([^；。]+)[。.]?/u
  );
  const legacySameEndpoint = text.match(
    /出发和返程城市都设为\s+(\S+)\s+(.+?)[。.]?$/u
  );
  const values = explicitPair
    ? {
        originCountry: explicitPair[1].trim(),
        originCity: explicitPair[2].trim(),
        returnCountry: explicitPair[3].trim(),
        returnCity: explicitPair[4].trim(),
      }
    : legacySameEndpoint
      ? {
          originCountry: legacySameEndpoint[1].trim(),
          originCity: legacySameEndpoint[2].trim(),
          returnCountry: legacySameEndpoint[1].trim(),
          returnCity: legacySameEndpoint[2].trim(),
        }
      : null;
  if (!values) return operations;

  const endpointPaths = new Set([
    "origin_country",
    "origin_city",
    "return_country",
    "return_city",
  ]);
  const next = operations.filter(
    (operation) => !endpointPaths.has(operation.path)
  );
  for (const [path, valueText] of [
    ["origin_country", values.originCountry],
    ["origin_city", values.originCity],
    ["return_country", values.returnCountry],
    ["return_city", values.returnCity],
  ] as const) {
    next.push({
      op: "set",
      path,
      valueText,
      valueNumber: null,
      valueBoolean: null,
      explicit: true,
      evidence: valueText,
    });
  }
  return next;
}

function replaceExplicitOperation(
  operations: TravelStateOperation[],
  operation: TravelStateOperation
): TravelStateOperation[] {
  return [
    ...operations.filter((item) => item.path !== operation.path),
    operation,
  ];
}

function splitPlannerDestinationValues(value: string): string[] {
  return value
    .replace(/[。.!！？?]+$/u, "")
    .split(/\s*(?:、|,|，|和|\band\b)\s*/iu)
    .map((item) => item.trim())
    .filter(Boolean);
}

function explicitPlannerDestinationOperations(
  text: string
): TravelStateOperation[] {
  const normalized = text.trim();
  const result: TravelStateOperation[] = [];
  const add = (
    path: "countries" | "cities",
    valueText: string,
    evidence: string
  ) => {
    for (const value of splitPlannerDestinationValues(valueText)) {
      result.push({
        op: "add",
        path,
        valueText: value,
        valueNumber: null,
        valueBoolean: null,
        explicit: true,
        evidence,
      });
    }
  };

  const updated = normalized.match(
    /^(?:我更新了目的地|destination updated|I updated the destination)[：:]\s*(?:城市|cities?)\s*(.+?)\s*[；;]\s*(?:国家|countries?)\s*(.+?)(?:[。.!！？?])?$/iu
  );
  if (updated) {
    add("cities", updated[1], updated[0]);
    add("countries", updated[2], updated[0]);
    return result;
  }

  const countrySelection = normalized.match(
    /^(?:我选择了国家|我选了国家|已选择国家|(?:I\s+)?selected\s+countries?)[：:]\s*(.+?)(?:[。.!！？?])?$/iu
  );
  if (countrySelection) {
    add("countries", countrySelection[1], countrySelection[0]);
    return result;
  }

  const citySelection = normalized.match(
    /^(?:我选择了城市|我选了城市|已选择城市|(?:I\s+)?selected\s+cities?)[：:]\s*(.+?)(?:[。.!！？?])?$/iu
  );
  if (citySelection) {
    add("cities", citySelection[1], citySelection[0]);
    return result;
  }

  return result;
}

function isItineraryDestinationRequest(text: string): boolean {
  const normalized = text.trim();
  return [
    /(?:计划|行程|安排)[\s\S]*?(?:去|前往)\s*\S+/iu,
    /\b(?:plan|create|make|build|arrange|organize)\b[\s\S]*?\b(?:trip|itinerary|travel\s+plan)\b[\s\S]*?\b(?:to|for)\s+\S+/iu,
  ].some((pattern) => pattern.test(normalized));
}

function directDestinationOperations(
  text: string,
  preferCitiesForItinerary = false,
  locale: InterfaceLocale = "zh"
): TravelStateOperation[] {
  const normalized = text.trim();
  if (
    DESTINATION_HYPOTHETICAL_PATTERN.test(normalized) ||
    DESTINATION_QUESTION_PATTERN.test(normalized)
  ) {
    return [];
  }
  const directMatch = normalized.match(
    /^(?:我想去|我要去|想去|就去|去|前往|I\s+want\s+to\s+go\s+to|I\s+would\s+like\s+to\s+go\s+to|go\s+to|travel\s+to)\s*(.+?)(?:[。.!！？?])?$/iu
  );
  const candidateTexts = new Set<string>();
  if (directMatch?.[1]) candidateTexts.add(directMatch[1]);
  for (const clause of normalized.split(
    /(?:[，,；;。.!！\n]+|(?:但是|但|不过|然而)|\b(?:but|however|while)\b)/iu
  )) {
    const clauseMatch = clause
      .trim()
      .match(
        /^(?:我想去|我要去|想去|就去|去|前往|I\s+want\s+to\s+go\s+to|I\s+would\s+like\s+to\s+go\s+to|go\s+to|travel\s+to)\s*(.+)$/iu
      );
    if (clauseMatch?.[1]) candidateTexts.add(clauseMatch[1]);

    const embeddedTravelMatch = clause
      .trim()
      .match(/\b(?:go|travel)\s+to\s+(.+)$/iu);
    if (embeddedTravelMatch?.[1]) candidateTexts.add(embeddedTravelMatch[1]);
  }
  const itineraryMatches = [
    normalized.match(
      /(?:计划|行程|安排)[\s\S]*?(?:去|前往)\s*(.+?)(?:[。.!！？?])?$/iu
    ),
    normalized.match(
      /\b(?:plan|create|make|build|arrange|organize)\b[\s\S]*?\b(?:trip|itinerary|travel\s+plan)\b[\s\S]*?\b(?:to|for)\s+(.+?)[.!?]?$/iu
    ),
  ];
  itineraryMatches.forEach((match) => {
    if (match?.[1]) candidateTexts.add(match[1]);
  });
  if (!candidateTexts.size) return [];

  return [...candidateTexts].flatMap((rawCandidate) => {
    const candidate = rawCandidate
      .replace(/[。.!！？?]+$/u, "")
      .replace(/(?:去)?(?:旅游|旅行|玩|travel|tour)$/iu, "")
      .trim();
    if (
      !candidate ||
      /^(?:哪里|哪儿|anywhere|somewhere)$/iu.test(candidate) ||
      isBroadDestinationCandidate(candidate)
    ) {
      return [];
    }

    const known = knownDestinationOperations(
      candidate,
      normalized,
      locale,
      false
    );
    if (known.length) return known;

    return splitPlannerDestinationValues(candidate).flatMap((value) => {
      if (
        !value ||
        /^(?:\d+|\d+\s*(?:天|日|days?|人|people|travelers?))$/iu.test(value) ||
        isBroadDestinationCandidate(value)
      ) {
        return [];
      }
      const path = destinationPathForValue(value, preferCitiesForItinerary);
      if (!path) return [];
      return [
        {
          op: "add" as const,
          path,
          valueText: value,
          valueNumber: null,
          valueBoolean: null,
          explicit: true,
          evidence: normalized,
        },
      ];
    });
  });
}

type DestinationReplacementParts = {
  oldText: string;
  newText: string;
};

function destinationReplacementParts(
  text: string
): DestinationReplacementParts | null {
  if (
    DESTINATION_HYPOTHETICAL_PATTERN.test(text) ||
    DESTINATION_QUESTION_PATTERN.test(text)
  ) {
    return null;
  }

  const match =
    text
      .trim()
      .match(
        /^(?:把|将)\s*(.+?)\s*(?:换成|改成|替换成|替换为|换为)\s*(.+?)(?:[。.!！？?])?$/u
      ) ??
    text
      .trim()
      .match(
        /^(?:replace|swap|change)\s+(.+?)\s+(?:with|to)\s+(.+?)[.!?]?$/iu
      ) ??
    text
      .trim()
      .match(
        /^(.+?)\s*(?:不要了|不去了|删除|删掉)[，,；;]\s*(?:改去|换成|改成|替换为|换到)\s*(.+?)[。.!！？?]?$/u
      );
  if (!match?.[1] || !match[2]) return null;

  return {
    oldText: match[1]
      .replace(/^(?:我|其实我)?\s*(?:不想去|不去|不要去|想去|要去)\s*/u, "")
      .trim(),
    newText: match[2].trim(),
  };
}

function explicitDestinationReplacementOperations(
  text: string,
  currentState: unknown,
  locale: InterfaceLocale
): TravelStateOperation[] {
  const parts = destinationReplacementParts(text);
  if (!parts?.oldText || !parts.newText) return [];

  const state = coerceTravelState(currentState);
  const selected: Array<{
    path: PlannerDestinationPath;
    value: string;
  }> = [
    ...state.cities.map((value) => ({ path: "cities" as const, value })),
    ...state.countries.map((value) => ({ path: "countries" as const, value })),
  ];
  const oldParts = splitPlannerDestinationValues(parts.oldText);
  const removals = selected.flatMap(({ path, value }) => {
    const mentioned = oldParts.some((oldValue) =>
      textMentionsDestination(oldValue, value, path === "cities")
    );
    if (!mentioned) return [];
    return [
      {
        op: "remove" as const,
        path,
        valueText: value,
        valueNumber: null,
        valueBoolean: null,
        explicit: true,
        evidence: text,
      },
    ];
  });
  if (!removals.length) return [];

  const additions = knownDestinationOperations(parts.newText, text, locale);
  return [...removals, ...additions];
}

function isExplicitDestinationConfirmation(
  text: string,
  currentState: unknown
): boolean {
  const state = coerceTravelState(currentState);
  if (!state.cities.length) return false;
  if (
    destinationReplacementParts(text) ||
    state.cities.some((city) =>
      textExplicitlyRemovesDestination(text, city, true)
    ) ||
    state.countries.some((country) =>
      textExplicitlyRemovesDestination(text, country, true)
    )
  ) {
    return false;
  }

  const normalized = text.trim();
  const specificConfirmation = [
    /^(?:好的?[，,]?\s*)?(?:(?:目的地|这些目的地|这些|以上目的地)\s*)?(?:就这些|可以了|没问题|这样就可以了|就按这些(?:来|安排)?)(?:[，,]\s*(?:继续|开始|进入)?[^。.!！？?]*)?(?:[。.!！？?])?$/iu,
    /^(?:确认|确定)(?:一下)?(?:目的地|这些(?:目的地)?|以上(?:目的地)?)?(?:了)?(?:[。.!！？?])?$/iu,
    /^(?:没有|没)(?:有)?(?:其他|别的|更多)(?:国家和城市|国家或城市|国家|城市|目的地)?(?:了)?(?:[。.!！？?])?$/iu,
    /^(?:不用|不再)(?:再)?(?:添加|加)?(?:其他|别的|更多)?(?:国家和城市|国家或城市|国家|城市|目的地)?(?:了)?(?:[。.!！？?])?$/iu,
    /^(?:that's all|no more(?: destinations?| countries?(?: or cities?)?| cities?)?|no other(?: destinations?| countries?(?: or cities?)?| cities?)?|confirm(?: these destinations?)?|okay,? that's enough)[.!?]?$/iu,
  ].some((pattern) => pattern.test(normalized));
  if (specificConfirmation) return true;

  return (
    nextMissingField(state) === "destination_confirmation" &&
    /^(?:确认|确定|好的|可以|没问题|ok|okay)$/iu.test(normalized)
  );
}

function appendExplicitDestinationOperations(
  operations: TravelStateOperation[],
  additions: TravelStateOperation[]
): TravelStateOperation[] {
  const destinationKey = (operation: TravelStateOperation): string | null => {
    if (
      (operation.path !== "countries" && operation.path !== "cities") ||
      !operation.valueText?.trim()
    ) {
      return null;
    }
    return `${operation.op}:${operation.path}:${canonicalDestinationValue(
      operation.path,
      operation.valueText
    )}`;
  };
  const explicitIncomingKeys = new Set(
    additions
      .filter((operation) => operation.explicit)
      .map(destinationKey)
      .filter((key): key is string => Boolean(key))
  );
  const supersededByExplicitFacts = (operation: TravelStateOperation) => {
    const key = destinationKey(operation);
    if (!key || operation.explicit || operation.op !== "add") return false;
    if (explicitIncomingKeys.has(key)) return true;
    if (operation.path !== "countries" && operation.path !== "cities") {
      return false;
    }
    const path: PlannerDestinationPath = operation.path;
    const parts = splitPlannerDestinationValues(operation.valueText ?? "");
    return (
      parts.length > 1 &&
      parts.every((part) =>
        explicitIncomingKeys.has(
          `add:${path}:${canonicalDestinationValue(path, part)}`
        )
      )
    );
  };
  // A deterministic fact recovered from the user's sentence supersedes a
  // model guess for the same operation/value. Keep add and remove separate:
  // they represent different user intents and must never share a key.
  const withoutSupersededGuesses = operations.filter((operation) => {
    return !supersededByExplicitFacts(operation);
  });
  const existing = new Set(
    withoutSupersededGuesses
      .map(destinationKey)
      .filter((key): key is string => Boolean(key))
  );
  const next = [...withoutSupersededGuesses];
  for (const operation of additions) {
    const key = destinationKey(operation);
    if (!key || existing.has(key)) continue;
    existing.add(key);
    next.push(operation);
  }
  return next;
}

function isExplicitPlannerDestinationForm(text: string): boolean {
  return explicitPlannerDestinationOperations(text).length > 0;
}

function stabilizeExplicitPlannerOperations(
  text: string,
  operations: TravelStateOperation[],
  hasSelectedCountry = false,
  locale: InterfaceLocale = "zh",
  currentState: unknown = null
): TravelStateOperation[] {
  let next = operations;
  const formDestinations = explicitPlannerDestinationOperations(text);
  next = appendExplicitDestinationOperations(next, formDestinations);
  const directDestinations = directDestinationOperations(
    text,
    hasSelectedCountry,
    locale
  );
  // Merge every explicit destination recovered from the user's sentence.
  // A partial model response must not hide another fact from the same turn.
  next = appendExplicitDestinationOperations(next, directDestinations);

  if (currentState !== null) {
    next = appendExplicitDestinationOperations(
      next,
      explicitDestinationReplacementOperations(text, currentState, locale)
    );
  }
  const setNumber = (
    path: "travel_days" | "travelers" | "budget",
    value: string,
    evidence: string
  ) => {
    const valueNumber = Number.parseInt(value, 10);
    if (!Number.isInteger(valueNumber) || valueNumber <= 0) return;
    next = replaceExplicitOperation(next, {
      op: "set",
      path,
      valueText: null,
      valueNumber,
      valueBoolean: null,
      explicit: true,
      evidence,
    });
  };

  const days = text.match(
    /(?:出行天数是|天数先灵活，?\s*暂按)?\s*(\d+)\s*(?:天|日|[-–]?\s*days?)(?:左右|上下)?/iu
  );
  if (days) setNumber("travel_days", days[1], days[0]);
  const travelers = text.match(
    /(?:出行人数是|人数先灵活，?\s*暂按)\s*(\d+)\s*(?:个)?人/u
  );
  if (travelers) setNumber("travelers", travelers[1], travelers[0]);
  const budget = text.match(
    /(?:预算是|预算先灵活，?\s*暂按)\s*(\d+)\s*(?:RMB|人民币|元)/iu
  );
  if (budget) setNumber("budget", budget[1], budget[0]);

  if (isExplicitDestinationConfirmation(text, currentState)) {
    next = replaceExplicitOperation(next, {
      op: "set",
      path: "destination_confirmed",
      valueText: null,
      valueNumber: null,
      valueBoolean: true,
      explicit: true,
      evidence: text,
    });
  }

  const travelOrder = text.match(/^游玩顺序：(.+?)[。.]?$/u);
  if (travelOrder) {
    next = replaceExplicitOperation(next, {
      op: "set",
      path: "travel_order",
      valueText: travelOrder[1].replace(/\s*→\s*/gu, "、"),
      valueNumber: null,
      valueBoolean: null,
      explicit: true,
      evidence: travelOrder[0],
    });
  }

  if (/^我没有额外备注，直接生成行程。?$/u.test(text)) {
    next = replaceExplicitOperation(next, {
      op: "set",
      path: "final_note",
      valueText: "",
      valueNumber: null,
      valueBoolean: null,
      explicit: true,
      evidence: "没有额外备注",
    });
  } else {
    const finalNote = text.match(/^备注：(.+)$/u);
    if (finalNote) {
      next = replaceExplicitOperation(next, {
        op: "set",
        path: "final_note",
        valueText: finalNote[1].trim(),
        valueNumber: null,
        valueBoolean: null,
        explicit: true,
        evidence: finalNote[0],
      });
    }
  }

  return next;
}

function resolveDestinationOperation(
  operation: TravelStateOperation,
  locale: InterfaceLocale,
  allowUnverifiedCity = false
): TravelStateOperation | null {
  // A country is a planner state value, not a destination card. The local
  // destination resolver intentionally rejects country-only text because it
  // cannot create a useful city card without a city. Applying that same card
  // gate to `countries` drops valid dropdown/custom selections and makes the
  // planner ask for the country again on the next turn.
  if (operation.path === "countries") {
    if (
      operation.valueText &&
      !isKnownCountryValue(operation.valueText) &&
      isKnownCityValue(operation.valueText)
    ) {
      return null;
    }
    return operation.valueText?.trim()
      ? { ...operation, valueText: operation.valueText.trim() }
      : null;
  }

  if (operation.path !== "cities" || !operation.valueText) {
    return operation;
  }
  if (
    isKnownCountryValue(operation.valueText) &&
    !isKnownCityValue(operation.valueText)
  ) {
    return null;
  }
  const resolution = resolveLocalDestinationText(operation.valueText);
  if (resolution.status !== "resolved" || !resolution.destinations.length) {
    const curatedLabel = getCuratedCityLabel(operation.valueText, locale);
    if (curatedLabel) {
      return { ...operation, valueText: curatedLabel };
    }
    if (allowUnverifiedCity) {
      return { ...operation, valueText: operation.valueText.trim() };
    }
    return null;
  }
  const destination = resolution.destinations[0];
  const value = destination.city || destination.displayName;
  if (!value) return null;
  return {
    ...operation,
    valueText:
      locale === "zh"
        ? (destination.nameZh ?? localizedCityName(operation.valueText, locale))
        : (destination.nameEn ?? value),
  };
}

function recommendationCards(
  recommendations: string[],
  userText: string,
  locale: InterfaceLocale
): TravelDestinationCard[] {
  const seen = new Set<string>();
  return recommendations
    .flatMap((recommendation) => {
      const resolution = resolveLocalDestinationText(recommendation);
      if (resolution.status !== "resolved") return [];
      return resolution.destinations.slice(0, 1).flatMap((destination) => {
        const key = destination.canonicalName.toLocaleLowerCase();
        if (seen.has(key)) return [];
        seen.add(key);
        return [
          {
            ...toTravelDestinationChatCard(destination, userText, locale),
            selection_state: "recommendation" as const,
          },
        ];
      });
    })
    .slice(0, 2);
}

function parsePendingActions(value: unknown): TravelStateOperation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = parseOperation(
      isRecord(item)
        ? {
            ...item,
            value_text: item.valueText,
            value_number: item.valueNumber,
            value_boolean: item.valueBoolean,
          }
        : item
    );
    return parsed ? [parsed] : [];
  });
}

function toPendingActionPreviews(
  actions: TravelStateOperation[]
): TravelPendingActionPreview[] {
  return actions.map((action) => ({
    op: action.op,
    path: action.path,
    valueText: action.valueText,
    valueNumber: action.valueNumber,
    valueBoolean: action.valueBoolean,
  }));
}

async function ensureSession(
  userId: string,
  request: TravelChatRequest
): Promise<TravelAgentSessionRow> {
  const admin = createAdminClient();
  const { data: existing, error: readError } = await admin
    .from("travel_agent_sessions")
    .select(
      "id, state_json, state_version, memory_summary, openai_previous_response_id, pending_actions_json"
    )
    .eq("id", request.sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (existing) return existing as TravelAgentSessionRow;

  const initial = {
    id: request.sessionId,
    user_id: userId,
    application_id: request.applicationId,
    state_json: toJson(coerceTravelState(null)),
    state_version: 0,
  };
  const { data, error } = await admin
    .from("travel_agent_sessions")
    .insert(initial)
    .select(
      "id, state_json, state_version, memory_summary, openai_previous_response_id, pending_actions_json"
    )
    .single();
  if (error) {
    if (error.code === "23505") return ensureSession(userId, request);
    throw new Error(error.message);
  }
  return data as TravelAgentSessionRow;
}

async function readSession(
  userId: string,
  sessionId: string
): Promise<TravelAgentSessionRow | null> {
  const { data, error } = await createAdminClient()
    .from("travel_agent_sessions")
    .select(
      "id, state_json, state_version, memory_summary, openai_previous_response_id, pending_actions_json"
    )
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as TravelAgentSessionRow | null;
}

function getUiAction(
  intent: TravelAgentIntent,
  nextField: TravelField | null
): TravelAgentUiAction {
  if (nextField) return "collect_field";
  if (intent === "generate_itinerary") return "generate_itinerary";
  if (intent === "modify_itinerary") return "revise_itinerary";
  return "none";
}

function incompleteItineraryReply(
  locale: InterfaceLocale,
  nextField: TravelField
): string {
  if (locale === "en") {
    return "Absolutely. I need one more detail before I can generate the itinerary.";
  }

  const prompts: Record<TravelField, string> = {
    country: "先告诉我想去哪个国家或地区",
    cities: "先告诉我想去哪些城市",
    destination_confirmation: "先确认一下目的地是否就这些",
    departure_date: "先确认出发日期",
    travel_days: "先确认这次旅行一共几天",
    travelers: "先确认一共有几位旅行者",
    budget: "先确认这次旅行的总预算",
    origin: "先确认出发和返程城市",
    travel_order: "先确认城市游览顺序",
    flight_selection: "先确认航班安排",
    hotel_selection: "先确认酒店安排",
    final_note: "最后确认一下补充要求",
  };
  return `可以。${prompts[nextField]}，补齐后我就为你生成完整行程。`;
}

function resolveExplicitItineraryIntent(
  text: string,
  modelIntent: TravelAgentIntent
): TravelAgentIntent {
  const asksToRevise =
    /(?:修改|调整|改(?:一下|一版)?|优化|重排).{0,18}(?:行程|路线|itinerary)|(?:revise|modify|change|adjust|rework).{0,24}(?:itinerary|trip|route)/iu.test(
      text
    );
  if (asksToRevise) return "modify_itinerary";

  const asksToGenerate =
    /(?:生成|安排|规划|制定|做|给我|来).{0,24}(?:行程|路线|itinerary)|(?:generate|create|make|build|plan|show).{0,24}(?:itinerary|trip itinerary|travel plan)/iu.test(
      text
    );
  return asksToGenerate ? "generate_itinerary" : modelIntent;
}

export async function GET(request: Request) {
  const auth = await getTravelUserSession();
  if (!auth) {
    return Response.json(
      { error: "Unauthorized", code: "session_expired" },
      { status: 401 }
    );
  }

  const sessionId = new URL(request.url).searchParams.get("sessionId")?.trim();
  if (!sessionId || sessionId.length > 160) {
    return Response.json({ error: "sessionId is required." }, { status: 400 });
  }

  try {
    const session = await readSession(auth.userId, sessionId);
    const state = coerceTravelState(session?.state_json ?? null);
    const pendingActions = parsePendingActions(session?.pending_actions_json);
    return Response.json(
      {
        exists: Boolean(session),
        state,
        state_version: session?.state_version ?? 0,
        next_missing_field: nextMissingField(state),
        pending_confirmation: pendingActions.length > 0,
        pending_actions: toPendingActionPreviews(pendingActions),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[travel-chat] canonical state read failure", error);
    return Response.json(
      {
        error: "Travel session state is temporarily unavailable.",
        code: "travel_session_unavailable",
      },
      { status: 503 }
    );
  }
}

async function loadRecentHistory(
  userId: string,
  sessionId: string
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const { data, error } = await createAdminClient()
    .from("travel_agent_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .reverse()
    .flatMap((item) =>
      (item.role === "user" || item.role === "assistant") &&
      typeof item.content === "string"
        ? [{ role: item.role, content: item.content }]
        : []
    );
}

async function loadStoredResponse(
  userId: string,
  sessionId: string,
  messageId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await createAdminClient()
    .from("travel_agent_messages")
    .select("response_json")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .eq("external_message_id", messageId)
    .eq("role", "user")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return isRecord(data?.response_json) ? data.response_json : null;
}

async function loadPreferences(userId: string): Promise<unknown> {
  const { data, error } = await createAdminClient()
    .from("travel_user_preferences")
    .select("preferences_json")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.preferences_json ?? {};
}

async function saveExplicitPreferences(
  userId: string,
  current: unknown,
  userText: string,
  updates: TravelAgentModelResult["preferenceUpdates"]
): Promise<void> {
  const accepted = updates.filter(
    (item) => item.explicit && item.evidence && userText.includes(item.evidence)
  );
  if (!accepted.length) return;

  const currentItems =
    isRecord(current) && Array.isArray(current.items)
      ? current.items.filter(isRecord)
      : [];
  const timestamp = new Date().toISOString();
  const byIdentity = new Map<string, Record<string, unknown>>();
  for (const item of currentItems) {
    if (typeof item.key !== "string" || typeof item.value !== "string")
      continue;
    byIdentity.set(`${item.key}:${item.value.toLocaleLowerCase()}`, item);
  }
  for (const item of accepted) {
    byIdentity.set(`${item.key}:${item.value.toLocaleLowerCase()}`, {
      id: crypto.randomUUID(),
      key: item.key,
      value: item.value,
      source: "explicit_travel_chat",
      created_at: timestamp,
    });
  }

  const { error } = await createAdminClient()
    .from("travel_user_preferences")
    .upsert(
      {
        user_id: userId,
        preferences_json: toJson({ items: Array.from(byIdentity.values()) }),
        updated_at: timestamp,
      },
      { onConflict: "user_id" }
    );
  if (error) {
    console.warn("[travel-chat] preference save skipped", error.message);
  }
}

export async function POST(request: Request) {
  const input = parseRequest(await request.json().catch(() => null));
  if (!input) {
    return Response.json(
      { error: "Invalid Travel Agent request." },
      { status: 400 }
    );
  }

  const auth = await getTravelUserSession();
  if (!auth) {
    return Response.json(
      {
        error:
          input.locale === "zh"
            ? "登录状态已过期，请重新登录后继续。你的旅行计划没有发生变化。"
            : "Your session has expired. Sign in again to continue. Your trip was not changed.",
        code: "session_expired",
      },
      { status: 401 }
    );
  }
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return Response.json(
      {
        error:
          input.locale === "zh"
            ? "旅行顾问暂时无法回复。你的旅行计划没有发生变化。"
            : "The Travel Advisor cannot reply right now. Your trip was not changed.",
        code: "openai_not_configured",
      },
      { status: 503 }
    );
  }

  try {
    const session = await ensureSession(auth.userId, input);
    const storedResponse = await loadStoredResponse(
      auth.userId,
      input.sessionId,
      input.messageId
    );
    if (storedResponse) {
      return Response.json(storedResponse, { status: 200 });
    }
    if (session.state_version !== input.expectedStateVersion) {
      return Response.json(
        {
          error:
            input.locale === "zh"
              ? "这份旅行计划已在其他页面更新，请刷新后继续。"
              : "This trip was updated elsewhere. Refresh before continuing.",
          code: "state_version_conflict",
          state: coerceTravelState(session.state_json),
          state_version: session.state_version,
        },
        { status: 409 }
      );
    }

    const pendingActions = parsePendingActions(session.pending_actions_json);
    const currentState = coerceTravelState(session.state_json);
    const [history, preferences] = await Promise.all([
      loadRecentHistory(auth.userId, input.sessionId),
      loadPreferences(auth.userId),
    ]);
    let openAI: Awaited<ReturnType<typeof callOpenAI>>;
    try {
      openAI = await callOpenAI({
        text: input.text,
        locale: input.locale,
        state: currentState,
        memorySummary: session.memory_summary,
        preferences,
        pendingActions,
        previousResponseId: session.openai_previous_response_id,
        history,
      });
    } catch (error) {
      console.error("[travel-chat] OpenAI failure", error);
      return Response.json(
        {
          error:
            input.locale === "zh"
              ? "旅行顾问这次没有成功回复。你的旅行计划没有发生变化。"
              : "The Travel Advisor could not complete that reply. Your trip was not changed.",
          code: "openai_request_failed",
          ...(process.env.NODE_ENV !== "production" && error instanceof Error
            ? { debug: error.message }
            : {}),
        },
        { status: 502 }
      );
    }

    const pendingDecisionIntent = resolvePendingDecisionIntent(
      input.text,
      openAI.result.intent,
      pendingActions
    );
    const hasSelectedCountry = currentState.countries.length > 0;
    let validated = stabilizeExplicitPlannerOperations(
      input.text,
      stabilizeExplicitEndpointOperations(
        input.text,
        stabilizeExplicitDateOperations(
          input.text,
          validateExplicitOperations(
            input.text,
            openAI.result.intent,
            openAI.result.operations,
            pendingActions
          )
        )
      ),
      hasSelectedCountry,
      input.locale,
      currentState
    );
    if (pendingDecisionIntent === "confirm_action") {
      // Confirmation applies the exact persisted, user-visible proposal. It
      // must not depend on the model repeating a scalar value in the short
      // confirmation message (for example, a previously proposed budget).
      validated = [
        ...pendingActions.map((operation) => ({
          ...operation,
          explicit: true,
          evidence: input.text,
        })),
        ...validated,
      ];
    } else if (pendingDecisionIntent === "reject_action") {
      // A rejection clears the proposal without letting model-generated
      // operations from the rejection turn mutate the trip.
      validated = [];
    }
    const allowUnverifiedCity =
      isExplicitPlannerDestinationForm(input.text) ||
      (hasSelectedCountry && isItineraryDestinationRequest(input.text));
    const resolved = validated.flatMap((operation) => {
      const item = resolveDestinationOperation(
        operation,
        input.locale,
        allowUnverifiedCity && operation.evidence.trim() === input.text
      );
      return item ? [item] : [];
    });
    for (const operation of [...resolved]) {
      if (
        operation.op !== "add" ||
        operation.path !== "cities" ||
        !operation.explicit ||
        !operation.valueText
      ) {
        continue;
      }
      const country = uniqueCountryForCity(operation.valueText, input.locale);
      const countryKey = country
        ? canonicalDestinationValue("countries", country)
        : "";
      if (
        country &&
        !currentState.countries.some(
          (value) =>
            canonicalDestinationValue("countries", value) === countryKey
        ) &&
        !resolved.some(
          (item) =>
            item.op === "add" &&
            item.path === "countries" &&
            item.valueText &&
            canonicalDestinationValue("countries", item.valueText) ===
              countryKey
        )
      ) {
        resolved.push({
          ...operation,
          path: "countries",
          valueText: country,
        });
      }
    }
    for (const pair of [
      { cityPath: "origin_city", countryPath: "origin_country" },
      { cityPath: "return_city", countryPath: "return_country" },
    ] as const) {
      const cityOperation = [...resolved]
        .reverse()
        .find(
          (item) =>
            item.op === "set" &&
            item.path === pair.cityPath &&
            item.explicit &&
            item.valueText
        );
      const city =
        cityOperation?.valueText?.trim() || currentState[pair.cityPath];
      const alreadyHasCountry = Boolean(
        resolved.some(
          (item) =>
            item.op === "set" &&
            item.path === pair.countryPath &&
            item.explicit &&
            item.valueText
        ) || currentState[pair.countryPath]
      );
      if (!city || alreadyHasCountry) continue;

      const destination = resolveLocalDestinationText(city);
      const country =
        destination.status === "resolved"
          ? (input.locale === "zh"
              ? (destination.destinations[0]?.countryNameZh ??
                destination.destinations[0]?.countryName)
              : (destination.destinations[0]?.countryNameEn ??
                destination.destinations[0]?.countryName)
            )?.trim()
          : "";
      if (!country) continue;
      resolved.push({
        op: "set",
        path: pair.countryPath,
        valueText: country,
        valueNumber: null,
        valueBoolean: null,
        explicit: true,
        evidence: cityOperation?.evidence || city,
      });
    }
    const explicitOperations = reconcileExplicitDepartureDate(
      input.text,
      reconcileExplicitDestinationRemovals(
        input.text,
        currentState,
        resolved.filter((operation) => operation.explicit)
      )
    );
    const mutation = applyTravelStateOperations(
      session.state_json,
      explicitOperations
    );
    const effectiveIntent = resolveExplicitItineraryIntent(
      input.text,
      pendingDecisionIntent
    );
    const nextField = nextMissingField(mutation.state);
    const uiAction = getUiAction(effectiveIntent, nextField);
    // An incomplete itinerary request gets a deterministic collect-field
    // reply. Any model-only inferences from that turn are not visible to the
    // user, so retaining them as pending actions would make a later generic
    // confirmation apply hidden changes. Keep only pending actions on turns
    // whose reply can actually expose them for confirmation.
    const nextPendingActions =
      pendingDecisionIntent === "reject_action" ||
      pendingDecisionIntent === "confirm_action" ||
      (effectiveIntent === "generate_itinerary" && Boolean(nextField))
        ? []
        : resolved.filter((operation) => !operation.explicit);
    const explicitlyRequestedRecommendations =
      /(推荐|建议|还有|其他|别的|替代|换一个|recommend|suggest|alternative|other)/iu.test(
        input.text
      );
    const allowRecommendationCards =
      effectiveIntent === "recommend_destinations" &&
      (mutation.state.cities.length === 0 ||
        explicitlyRequestedRecommendations);
    const coordinatedReply =
      effectiveIntent === "generate_itinerary" && nextField
        ? incompleteItineraryReply(input.locale, nextField)
        : openAI.result.reply;
    const nextVersion = session.state_version + 1;
    const responseBody = {
      reply: coordinatedReply,
      mode: effectiveIntent,
      cards: allowRecommendationCards
        ? recommendationCards(
            openAI.result.recommendations,
            input.text,
            input.locale
          )
        : [],
      quick_replies: openAI.result.quickReplies,
      state: mutation.state,
      state_version: nextVersion,
      next_missing_field: nextField,
      ui_action: uiAction,
      applied_operations: mutation.applied,
      pending_confirmation: nextPendingActions.length > 0,
      pending_actions: toPendingActionPreviews(nextPendingActions),
    };

    const { data: commitData, error: commitError } =
      await createAdminClient().rpc("commit_travel_agent_turn", {
        p_session_id: input.sessionId,
        p_user_id: auth.userId,
        p_external_message_id: input.messageId,
        p_expected_state_version: input.expectedStateVersion,
        p_user_content: input.text,
        p_assistant_content: coordinatedReply,
        p_state_json: toJson(mutation.state),
        p_memory_summary: openAI.result.memorySummary,
        p_openai_response_id: openAI.id,
        p_pending_actions_json: toJson(nextPendingActions),
        p_response_json: toJson(responseBody),
      });
    if (commitError) throw new Error(commitError.message);
    if (!isRecord(commitData)) throw new Error("Invalid conversation commit.");
    if (commitData.status === "conflict") {
      return Response.json(
        {
          error:
            input.locale === "zh"
              ? "这份旅行计划刚刚被更新，请重试。"
              : "This trip was just updated. Please retry.",
          code: "state_version_conflict",
          state: coerceTravelState(commitData.state),
          state_version: commitData.state_version,
        },
        { status: 409 }
      );
    }
    if (
      (commitData.status === "ok" || commitData.status === "replayed") &&
      isRecord(commitData.response)
    ) {
      if (commitData.status === "ok") {
        await saveExplicitPreferences(
          auth.userId,
          preferences,
          input.text,
          openAI.result.preferenceUpdates
        );
      }
      return Response.json(commitData.response, { status: 200 });
    }
    throw new Error("Travel conversation session is unavailable.");
  } catch (error) {
    console.error("[travel-chat] coordinator failure", error);
    return Response.json(
      {
        error:
          input.locale === "zh"
            ? "旅行会话暂时无法保存。你的旅行计划没有发生变化。"
            : "The travel conversation could not be saved. Your trip was not changed.",
        code: "travel_session_unavailable",
        ...(process.env.NODE_ENV !== "production" && error instanceof Error
          ? { debug: error.message }
          : {}),
      },
      { status: 503 }
    );
  }
}
