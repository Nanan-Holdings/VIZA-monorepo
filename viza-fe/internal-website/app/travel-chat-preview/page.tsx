import { notFound } from "next/navigation";
import { TravelChatClient } from "../client/travel-chat/travel-chat-client";
import { LanguageSelector } from "@/components/client/language-selector";

export default function TravelChatPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <>
    <div className="fixed right-4 top-4 z-50 rounded-full bg-white shadow-sm">
      <LanguageSelector />
    </div>
    <TravelChatClient applicationId={null} />
  </>;
}
