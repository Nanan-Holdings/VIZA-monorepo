export type TravelDestinationCard = {
  type: "destination";
  id?: string;
  destination_id?: string;
  title: string;
  subtitle: string;
  country: string;
  city?: string | null;
  image_key?: string | null;
  cover_image_url?: string | null;
  image_status?: "verified" | "enriched" | "placeholder" | "pending";
  data_quality?: "verified" | "enriched" | "generated" | "placeholder" | "incomplete";
  source_status?:
    | "local_verified"
    | "local_cached"
    | "api_enriched"
    | "llm_generated"
    | "placeholder";
  completeness_score?: number | null;
  missing_fields?: string[];
  attraction_count?: number;
  map_marker?: { lat: number; lng: number } | null;
  localized_names?: {
    en?: string | null;
    zh?: string | null;
  };
  highlights: string[];
  suggested_days?: string | null;
  action_label: string;
  payload: Record<string, unknown>;
};

export type TravelQuickReply = {
  label: string;
  value: string;
};

export type TravelChatTextPart = {
  type: "text";
  text: string;
};

export type TravelChatDestinationCardsPart = {
  type: "destination_cards";
  cards: TravelDestinationCard[];
};

export type TravelChatQuickRepliesPart = {
  type: "quick_replies";
  quick_replies: TravelQuickReply[];
};

export type TravelChatPlannerFormPart = {
  type: "planner_form";
};

export type TravelChatToolItineraryDay = {
  day?: number | string;
  city?: string;
  activities?: string[];
  food?: string[];
  cost?: string;
};

export type TravelChatToolItineraryPart = {
  type: "tool-itinerary";
  output: TravelChatToolItineraryDay[];
};

export type TravelChatMessagePart =
  | TravelChatTextPart
  | TravelChatDestinationCardsPart
  | TravelChatQuickRepliesPart
  | TravelChatPlannerFormPart
  | TravelChatToolItineraryPart;

export type TravelChatMessage = {
  id: string;
  role: "user" | "assistant";
  parts: TravelChatMessagePart[];
};

export type TravelChatInputMessage = {
  role: "user" | "assistant";
  parts: TravelChatMessagePart[];
};

export type TravelChatStatus = "ready" | "submitted" | "streaming";
