import { redirect } from "next/navigation";
import { ChatClient } from "./chat-client";
import { getOrCreateUserSession } from "@/app/actions/companion-sessions";
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

  const sessionResult = await getOrCreateUserSession(userId);

  return (
    <ChatClient
      userId={userId}
      initialSessionId={sessionResult?.session.id ?? null}
      initialMessages={sessionResult?.messages ?? []}
    />
  );
}
