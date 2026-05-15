export type TravelDestinationCard = {
  type: "destination";
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

export type TravelChatMessagePart =
  | TravelChatTextPart
  | TravelChatDestinationCardsPart
  | TravelChatQuickRepliesPart
  | TravelChatPlannerFormPart;

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
