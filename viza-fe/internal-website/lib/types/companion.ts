export interface MockMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}
