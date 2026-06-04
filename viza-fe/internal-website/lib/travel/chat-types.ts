export type TravelDestinationCard = {
  type: "destination";
  id?: string;
  destination_id?: string;
  title: string;
  subtitle: string;
  country: string;
  city?: string | null;
  image_key?: string | null;
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
