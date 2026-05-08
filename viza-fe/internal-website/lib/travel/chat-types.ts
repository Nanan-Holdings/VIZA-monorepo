export type TravelChatMessagePart = {
  type: "text";
  text: string;
};

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
