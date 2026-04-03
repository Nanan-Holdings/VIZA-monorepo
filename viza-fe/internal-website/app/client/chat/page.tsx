import { redirect } from "next/navigation";
import { ChatClient } from "./chat-client";
import {
  getUserSessions,
  getRecentMessages,
  getMessagePreviews,
} from "@/app/actions/companion-sessions";
import { getImpersonationSession } from "@/lib/impersonation-session";
import { getUserFromSupabaseSession } from "@/lib/client-session";

export const dynamic = "force-dynamic";

async function getUserId(): Promise<string | null> {
  const impersonation = await getImpersonationSession();
  if (impersonation) {
    return impersonation.userId;
  }

  const session = await getUserFromSupabaseSession();
  if (session) {
    return session.userId;
  }

  return null;
}

export default async function ChatPage() {
  const userId = await getUserId();

  if (!userId) {
    redirect("/client/login");
  }

  const [sessions, recentMessagesResult, checkpointsResult] = await Promise.all([
    getUserSessions(userId),
    getRecentMessages(userId, 20),
    getMessagePreviews(userId, { limit: 20, offset: 0 }),
  ]);

  return (
    <ChatClient
      userId={userId}
      initialSessions={sessions}
      initialActiveSession={sessions[0] || null}
      initialMessages={recentMessagesResult.messages}
      initialCheckpoints={checkpointsResult.previews}
      isFirstTimeUser={recentMessagesResult.isFirstTimeUser}
    />
  );
}
