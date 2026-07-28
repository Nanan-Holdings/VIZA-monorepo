import { notFound } from "next/navigation";
import { TravelChatClient } from "../client/travel-chat/travel-chat-client";

export default function TravelChatPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <TravelChatClient applicationId={null} />;
}
