export type TravelErrorStage =
  | "parse_intent"
  | "resolve_destination"
  | "local_destination_lookup"
  | "google_places_search"
  | "google_place_details"
  | "google_place_photos"
  | "llm_itinerary_generation"
  | "render_cards"
  | "save_itinerary"
  | "primary_travel_service"
  | "unknown";

export type TravelPipelineError = {
  code: string;
  stage: TravelErrorStage;
  userMessageZh: string;
  userMessageEn: string;
  retryable: boolean;
  fallbackAttempted: boolean;
  fallbackUsed: string[];
  debugId: string;
};

export type TravelPipelineLogEvent = {
  debugId: string;
  stage: TravelErrorStage | "success";
  message: string;
  details?: Record<string, unknown>;
};

export function createTravelDebugId(prefix = "travel"): string {
  const random =
    globalThis.crypto?.randomUUID?.().slice(0, 8) ??
    Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) return error.trim();
  return "Unknown error";
}

export function normalizeTravelPipelineError(options: {
  code: string;
  stage: TravelErrorStage;
  debugId: string;
  retryable?: boolean;
  fallbackAttempted?: boolean;
  fallbackUsed?: string[];
  userMessageZh?: string;
  userMessageEn?: string;
}): TravelPipelineError {
  return {
    code: options.code,
    stage: options.stage,
    userMessageZh:
      options.userMessageZh ??
      "旅行服务暂时不可用，已尝试使用备用数据源生成行程。请稍后重试。",
    userMessageEn:
      options.userMessageEn ??
      "The travel service is temporarily unavailable. I tried backup data sources; please try again shortly.",
    retryable: options.retryable ?? true,
    fallbackAttempted: options.fallbackAttempted ?? false,
    fallbackUsed: options.fallbackUsed ?? [],
    debugId: options.debugId,
  };
}

export function logTravelPipelineEvent(event: TravelPipelineLogEvent): void {
  console.info("[travel-pipeline]", {
    debugId: event.debugId,
    stage: event.stage,
    message: event.message,
    ...(event.details ? { details: event.details } : {}),
  });
}
