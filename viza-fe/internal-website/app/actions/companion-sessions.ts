"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getImpersonationSession } from "@/lib/impersonation-session";
import { getUserFromSupabaseSession } from "@/lib/client-session";

// =============================================================================
// Types
// =============================================================================

export interface Session {
  id: string;
  userId: string;
  journeyType: string;
  state: string;
  startedAt: string | null;
  endedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string | null;
  /** Preview of first message (for sidebar display) */
  firstMessagePreview?: string;
}

export interface MessagePreview {
  id: string;
  sessionId: string;
  content: string;
  createdAt: string | null;
  /** For showing conversation separators in sidebar */
  isFirstInSession?: boolean;
}

export interface SearchResult {
  id: string;
  sessionId: string;
  content: string;
  senderType: "user" | "agent" | "system";
  createdAt: string | null;
  /** The matched snippet with search term */
  matchSnippet: string;
}

export interface Message {
  id: string;
  sessionId: string;
  senderType: "user" | "agent" | "system";
  content: string;
  intent: string | null;
  riskLevel: string | null;
  createdAt: string | null;
}

// =============================================================================
// Helper: Get authenticated user ID
// =============================================================================

async function getAuthenticatedUserId(): Promise<string | null> {
  // Check impersonation first
  const impersonation = await getImpersonationSession();
  if (impersonation) {
    return impersonation.userId;
  }

  // Check Supabase session
  const session = await getUserFromSupabaseSession();
  if (session) {
    return session.userId;
  }

  return null;
}

// =============================================================================
// Server Actions
// =============================================================================

/**
 * Get user's sessions (max 10, ordered by created_at DESC)
 * Includes first message preview for sidebar display
 */
export async function getUserSessions(userId: string): Promise<Session[]> {
  const authenticatedUserId = await getAuthenticatedUserId();

  // Security check: only allow fetching own sessions (or impersonated user)
  if (!authenticatedUserId || authenticatedUserId !== userId) {
    return [];
  }

  try {
    const adminClient = createAdminClient();

    // Fetch sessions
    const { data: sessions, error } = await adminClient
      .from("visa_chat_sessions")
      .select("*")
      .eq("applicant_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return [];
    }

    if (!sessions || sessions.length === 0) {
      return [];
    }

    // Get first message for each session (for preview)
    const sessionIds = sessions.map((s) => s.id);
    const { data: firstMessages } = await adminClient
      .from("visa_chat_messages")
      .select("session_id, content")
      .in("session_id", sessionIds)
      .eq("role", "user")
      .order("created_at", { ascending: true });

    // Create a map of session_id -> first user message
    const firstMessageMap = new Map<string, string>();
    if (firstMessages) {
      for (const msg of firstMessages) {
        if (!firstMessageMap.has(msg.session_id)) {
          firstMessageMap.set(msg.session_id, msg.content);
        }
      }
    }

    return sessions.map((session) => ({
      id: session.id,
      userId: session.applicant_id,
      journeyType: "check_in",
      state: "active",
      startedAt: session.created_at,
      endedAt: session.updated_at,
      metadata: {},
      createdAt: session.created_at,
      firstMessagePreview: firstMessageMap.get(session.id)?.slice(0, 30) || undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * Get messages for a session (last 50, verify ownership)
 */
export async function getSessionMessages(
  sessionId: string,
  userId: string
): Promise<Message[]> {
  const authenticatedUserId = await getAuthenticatedUserId();

  // Security check
  if (!authenticatedUserId || authenticatedUserId !== userId) {
    console.error("Unauthorized message fetch attempt", { userId, authenticatedUserId });
    return [];
  }

  const adminClient = createAdminClient();

  // Verify session belongs to user
  const { data: session, error: sessionError } = await adminClient
    .from("visa_chat_sessions")
    .select("id, applicant_id")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session || session.applicant_id !== userId) {
    console.error("Session not found or doesn't belong to user", {
      sessionId,
      userId,
      sessionUserId: session?.applicant_id,
    });
    return [];
  }

  // Fetch messages
  const { data: messages, error } = await adminClient
    .from("visa_chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    console.error("Error fetching messages:", error);
    return [];
  }

  return (messages || []).map((msg) => ({
    id: msg.id,
    sessionId: msg.session_id,
    senderType: (msg.role === "assistant" ? "agent" : msg.role) as Message["senderType"],
    content: msg.content,
    intent: null,
    riskLevel: null,
    createdAt: msg.created_at,
  }));
}

/**
 * Get most recent active session (for auto-resume)
 */
export async function getLatestActiveSession(
  userId: string
): Promise<Session | null> {
  const authenticatedUserId = await getAuthenticatedUserId();

  // Security check
  if (!authenticatedUserId || authenticatedUserId !== userId) {
    console.error("Unauthorized session fetch attempt", { userId, authenticatedUserId });
    return null;
  }

  const adminClient = createAdminClient();

  const { data: session, error } = await adminClient
    .from("visa_chat_sessions")
    .select("*")
    .eq("applicant_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching latest active session:", error);
    return null;
  }

  if (!session) {
    return null;
  }

  // Get first user message for preview
  const { data: firstMessage } = await adminClient
    .from("visa_chat_messages")
    .select("content")
    .eq("session_id", session.id)
    .eq("role", "user")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    id: session.id,
    userId: session.applicant_id,
    journeyType: "check_in",
    state: "active",
    startedAt: session.created_at,
    endedAt: session.updated_at,
    metadata: {},
    createdAt: session.created_at,
    firstMessagePreview: firstMessage?.content?.slice(0, 30) || undefined,
  };
}

/**
 * Create new session (called on first message send if no session exists)
 */
export async function createSession(userId: string): Promise<Session | null> {
  const authenticatedUserId = await getAuthenticatedUserId();

  // Security check
  if (!authenticatedUserId || authenticatedUserId !== userId) {
    console.error("Unauthorized session creation attempt", { userId, authenticatedUserId });
    return null;
  }

  const adminClient = createAdminClient();

  const { data: session, error } = await adminClient
    .from("visa_chat_sessions")
    .insert({
      applicant_id: userId,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating session:", error);
    return null;
  }

  return {
    id: session.id,
    userId: session.applicant_id,
    journeyType: "check_in",
    state: "active",
    startedAt: session.created_at,
    endedAt: session.updated_at,
    metadata: {},
    createdAt: session.created_at,
  };
}

// =============================================================================
// Continuous Chat Server Actions
// =============================================================================

/**
 * Get message previews for sidebar checkpoints (user messages only)
 * Returns paginated list of user messages across all sessions in 30-day window
 */
export async function getMessagePreviews(
  userId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ previews: MessagePreview[]; hasMore: boolean }> {
  const authenticatedUserId = await getAuthenticatedUserId();

  if (!authenticatedUserId || authenticatedUserId !== userId) {
    return { previews: [], hasMore: false };
  }

  try {
    const { limit = 20, offset = 0 } = options;
    const adminClient = createAdminClient();

    // Calculate 30-day boundary
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get user messages with session info
    const { data: messages, error } = await adminClient
      .from("visa_chat_messages")
      .select(`
        id,
        session_id,
        content,
        created_at,
        visa_chat_sessions!inner(applicant_id, created_at)
      `)
      .eq("role", "user")
      .eq("visa_chat_sessions.applicant_id", userId)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .range(offset, offset + limit);

    if (error) {
      return { previews: [], hasMore: false };
    }

    // Track which sessions we've seen to mark first message in each session
    const seenSessions = new Set<string>();

    const previews: MessagePreview[] = (messages || []).map((msg) => {
      const isFirstInSession = !seenSessions.has(msg.session_id);
      seenSessions.add(msg.session_id);

      return {
        id: msg.id,
        sessionId: msg.session_id,
        content: msg.content.slice(0, 30) + (msg.content.length > 30 ? "..." : ""),
        createdAt: msg.created_at,
        isFirstInSession,
      };
    });

    return {
      previews,
      hasMore: (messages?.length || 0) > limit,
    };
  } catch {
    return { previews: [], hasMore: false };
  }
}

/**
 * Get messages around a specific checkpoint message
 * For jumping to a message in the continuous stream
 */
export async function getMessagesAroundCheckpoint(
  userId: string,
  messageId: string,
  options: { before?: number; after?: number } = {}
): Promise<{
  messages: Message[];
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
  targetMessage: Message | null;
}> {
  const authenticatedUserId = await getAuthenticatedUserId();

  if (!authenticatedUserId || authenticatedUserId !== userId) {
    console.error("Unauthorized messages around checkpoint fetch", { userId, authenticatedUserId });
    return { messages: [], hasMoreBefore: false, hasMoreAfter: false, targetMessage: null };
  }

  const { before = 15, after = 15 } = options;
  const adminClient = createAdminClient();

  // Calculate 30-day boundary
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // First get the target message to find its timestamp
  const { data: targetMsg, error: targetError } = await adminClient
    .from("visa_chat_messages")
    .select(`
      id,
      session_id,
      role,
      content,
      created_at,
      visa_chat_sessions!inner(applicant_id)
    `)
    .eq("id", messageId)
    .eq("visa_chat_sessions.applicant_id", userId)
    .single();

  if (targetError || !targetMsg) {
    console.error("Error fetching target message:", targetError);
    return { messages: [], hasMoreBefore: false, hasMoreAfter: false, targetMessage: null };
  }

  const targetTimestamp = targetMsg.created_at;

  // Get messages before the target (older)
  const { data: beforeMessages } = await adminClient
    .from("visa_chat_messages")
    .select(`
      id,
      session_id,
      role,
      content,
      created_at,
      visa_chat_sessions!inner(applicant_id)
    `)
    .eq("visa_chat_sessions.applicant_id", userId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .lt("created_at", targetTimestamp)
    .order("created_at", { ascending: false })
    .limit(before + 1);

  // Get messages after the target (newer)
  const { data: afterMessages } = await adminClient
    .from("visa_chat_messages")
    .select(`
      id,
      session_id,
      role,
      content,
      created_at,
      visa_chat_sessions!inner(applicant_id)
    `)
    .eq("visa_chat_sessions.applicant_id", userId)
    .gt("created_at", targetTimestamp)
    .order("created_at", { ascending: true })
    .limit(after + 1);

  const hasMoreBefore = (beforeMessages?.length || 0) > before;
  const hasMoreAfter = (afterMessages?.length || 0) > after;

  // Combine and format messages
  const allRawMessages = [
    ...(beforeMessages || []).slice(0, before).reverse(),
    targetMsg,
    ...(afterMessages || []).slice(0, after),
  ];

  const formatMessage = (msg: typeof targetMsg): Message => ({
    id: msg.id,
    sessionId: msg.session_id,
    senderType: (msg.role === "assistant" ? "agent" : msg.role) as Message["senderType"],
    content: msg.content,
    intent: null,
    riskLevel: null,
    createdAt: msg.created_at,
  });

  return {
    messages: allRawMessages.map(formatMessage),
    hasMoreBefore,
    hasMoreAfter,
    targetMessage: formatMessage(targetMsg),
  };
}

/**
 * Load more history when scrolling up
 * Uses cursor-based pagination (before timestamp)
 */
export async function loadMoreHistory(
  userId: string,
  beforeTimestamp: string,
  limit: number = 20
): Promise<{
  messages: Message[];
  hasMore: boolean;
  reachedBoundary: boolean;
}> {
  const authenticatedUserId = await getAuthenticatedUserId();

  if (!authenticatedUserId || authenticatedUserId !== userId) {
    console.error("Unauthorized history load attempt", { userId, authenticatedUserId });
    return { messages: [], hasMore: false, reachedBoundary: false };
  }

  const adminClient = createAdminClient();

  // Calculate 30-day boundary
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: messages, error } = await adminClient
    .from("visa_chat_messages")
    .select(`
      id,
      session_id,
      role,
      content,
      created_at,
      visa_chat_sessions!inner(applicant_id)
    `)
    .eq("visa_chat_sessions.applicant_id", userId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .lt("created_at", beforeTimestamp)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (error) {
    console.error("Error loading more history:", error);
    return { messages: [], hasMore: false, reachedBoundary: false };
  }

  const hasMore = (messages?.length || 0) > limit;
  const formattedMessages = (messages || []).slice(0, limit).reverse().map((msg) => ({
    id: msg.id,
    sessionId: msg.session_id,
    senderType: (msg.role === "assistant" ? "agent" : msg.role) as Message["senderType"],
    content: msg.content,
    intent: null,
    riskLevel: null,
    createdAt: msg.created_at,
  }));

  // Check if we've reached the 30-day boundary
  const oldestMessage = formattedMessages[0];
  const reachedBoundary = !hasMore && oldestMessage &&
    new Date(oldestMessage.createdAt!).getTime() <= thirtyDaysAgo.getTime() + 86400000; // within 1 day of boundary

  return {
    messages: formattedMessages,
    hasMore,
    reachedBoundary,
  };
}

/**
 * Search messages across all sessions in 30-day window
 */
export async function searchMessages(
  userId: string,
  query: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{
  results: SearchResult[];
  hasMore: boolean;
  totalCount: number;
}> {
  const authenticatedUserId = await getAuthenticatedUserId();

  if (!authenticatedUserId || authenticatedUserId !== userId) {
    console.error("Unauthorized search attempt", { userId, authenticatedUserId });
    return { results: [], hasMore: false, totalCount: 0 };
  }

  // Minimum 3 characters for search
  if (query.length < 3) {
    return { results: [], hasMore: false, totalCount: 0 };
  }

  const { limit = 20, offset = 0 } = options;
  const adminClient = createAdminClient();

  // Calculate 30-day boundary
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Search using ILIKE for simple text search
  const { data: messages, error, count } = await adminClient
    .from("visa_chat_messages")
    .select(`
      id,
      session_id,
      role,
      content,
      created_at,
      visa_chat_sessions!inner(applicant_id)
    `, { count: "exact" })
    .eq("visa_chat_sessions.applicant_id", userId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .ilike("content", `%${query}%`)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit);

  if (error) {
    console.error("Error searching messages:", error);
    return { results: [], hasMore: false, totalCount: 0 };
  }

  // Create snippets with match highlighting info
  const results: SearchResult[] = (messages || []).map((msg) => {
    // Find the match position and create a snippet
    const lowerContent = msg.content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const matchIndex = lowerContent.indexOf(lowerQuery);

    // Create snippet around the match (50 chars before and after)
    const snippetStart = Math.max(0, matchIndex - 50);
    const snippetEnd = Math.min(msg.content.length, matchIndex + query.length + 50);
    let matchSnippet = msg.content.slice(snippetStart, snippetEnd);

    if (snippetStart > 0) matchSnippet = "..." + matchSnippet;
    if (snippetEnd < msg.content.length) matchSnippet = matchSnippet + "...";

    return {
      id: msg.id,
      sessionId: msg.session_id,
      content: msg.content,
      senderType: (msg.role === "assistant" ? "agent" : msg.role) as SearchResult["senderType"],
      createdAt: msg.created_at,
      matchSnippet,
    };
  });

  return {
    results,
    hasMore: (count || 0) > offset + limit,
    totalCount: count || 0,
  };
}

/**
 * Get recent messages for initial load (most recent 20)
 */
export async function getRecentMessages(
  userId: string,
  limit: number = 20
): Promise<{
  messages: Message[];
  hasMoreHistory: boolean;
  isFirstTimeUser: boolean;
}> {
  const authenticatedUserId = await getAuthenticatedUserId();

  if (!authenticatedUserId || authenticatedUserId !== userId) {
    return { messages: [], hasMoreHistory: false, isFirstTimeUser: true };
  }

  try {
    const adminClient = createAdminClient();

    // Calculate 30-day boundary
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: messages, error, count } = await adminClient
      .from("visa_chat_messages")
      .select(`
        id,
        session_id,
        role,
        content,
        created_at,
        visa_chat_sessions!inner(applicant_id)
      `, { count: "exact" })
      .eq("visa_chat_sessions.applicant_id", userId)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(limit + 1);

    if (error) {
      return { messages: [], hasMoreHistory: false, isFirstTimeUser: true };
    }

    const hasMoreHistory = (messages?.length || 0) > limit;
    const formattedMessages = (messages || []).slice(0, limit).reverse().map((msg) => ({
      id: msg.id,
      sessionId: msg.session_id,
      senderType: (msg.role === "assistant" ? "agent" : msg.role) as Message["senderType"],
      content: msg.content,
      intent: null,
      riskLevel: null,
      createdAt: msg.created_at,
    }));

    return {
      messages: formattedMessages,
      hasMoreHistory,
      isFirstTimeUser: (count || 0) === 0,
    };
  } catch {
    return { messages: [], hasMoreHistory: false, isFirstTimeUser: true };
  }
}

// =============================================================================
// US-034: Single Persistent Session Per User
// =============================================================================

export interface UserChatSessionResult {
  session: {
    id: string;
    authUserId: string;
    visaPackageId: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
  messages: Message[];
}

/**
 * Get or create the single persistent chat session for a user.
 * Upserts user_chat_sessions by auth_user_id, returns session + last 100 messages.
 */
export async function getOrCreateUserSession(
  userId: string
): Promise<UserChatSessionResult | null> {
  const authenticatedUserId = await getAuthenticatedUserId();

  if (!authenticatedUserId || authenticatedUserId !== userId) {
    return null;
  }

  try {
    const adminClient = createAdminClient();

    // Upsert the single session row for this user
    const { data: session, error: sessionError } = await adminClient
      .from("user_chat_sessions")
      .upsert(
        { auth_user_id: userId, updated_at: new Date().toISOString() },
        { onConflict: "auth_user_id" }
      )
      .select()
      .single();

    if (sessionError || !session) {
      console.error("Error upserting user_chat_sessions:", sessionError);
      return null;
    }

    // Fetch last 100 messages across all visa_chat_sessions for this user
    // (The session id in user_chat_sessions is used as the socket session_id)
    const { data: messages, error: messagesError } = await adminClient
      .from("visa_chat_messages")
      .select(`
        id,
        session_id,
        role,
        content,
        created_at,
        visa_chat_sessions!inner(applicant_id)
      `)
      .eq("visa_chat_sessions.applicant_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (messagesError) {
      console.error("Error fetching messages for user session:", messagesError);
    }

    const formattedMessages: Message[] = ((messages || []).reverse()).map((msg) => ({
      id: msg.id,
      sessionId: msg.session_id,
      senderType: (msg.role === "assistant" ? "agent" : msg.role) as Message["senderType"],
      content: msg.content,
      intent: null,
      riskLevel: null,
      createdAt: msg.created_at,
    }));

    return {
      session: {
        id: session.id,
        authUserId: session.auth_user_id,
        visaPackageId: session.visa_package_id ?? null,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      },
      messages: formattedMessages,
    };
  } catch (err) {
    console.error("getOrCreateUserSession error:", err);
    return null;
  }
}
