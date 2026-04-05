"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Bug,
  Clock,
  Menu,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

import { useAgentSocket } from "@/hooks/use-agent-socket";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { ThinkingIndicator } from "./thinking-indicator";
import { ConnectionStatus } from "./connection-status";
import { SessionSidebar } from "./session-sidebar";
import {
  getUserSessions,
  getSessionMessages,
  createSession,
  getRecentMessages,
  type Session,
  type Message,
} from "@/app/actions/companion-sessions";
import type { ChatMessage as SocketChatMessage } from "@/types/agent-test";

// Lazy load debug panel
const DebugPanel = dynamic(
  () => import("./debug-panel").then((mod) => ({ default: mod.DebugPanel })),
  { ssr: false }
);

// =============================================================================
// Types
// =============================================================================

interface CompanionChatProps {
  userId: string;
  initialSessions: Session[];
  initialActiveSession: Session | null;
  initialMessages: Message[];
}

// Suggested prompts for the selection view
const suggestedPrompts = [
  "What documents do I need for my visa?",
  "How long does the application process take?",
  "Can you explain the next steps in my application?",
];

// Agent backend URL (configurable via env)
const AGENT_BACKEND_URL =
  process.env.NEXT_PUBLIC_AGENT_BACKEND_URL || "http://localhost:3002";

// =============================================================================
// Component
// =============================================================================

export function CompanionChat({
  userId,
  initialSessions,
  initialActiveSession,
  initialMessages,
}: CompanionChatProps) {
  // ==========================================================================
  // State
  // ==========================================================================

  // Session state
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [sessionId, setSessionId] = useState<string | null>(
    initialActiveSession?.id || null
  );
  const [historicalMessages, setHistoricalMessages] = useState<Message[]>(
    initialMessages
  );
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // UI state
  const [showChat, setShowChat] = useState(!!initialActiveSession);
  const [showDebug, setShowDebug] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [input, setInput] = useState("");
  // Offline queue
  const [pendingMessages, setPendingMessages] = useState<string[]>([]);

  // Smart scroll state
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // ==========================================================================
  // Socket Connection
  // ==========================================================================

  const {
    status,
    messages: socketMessages,
    logs,
    sendMessage: socketSendMessage,
    clearLogs,
    clearMessages: clearSocketMessages,
    connect,
    disconnect,
  } = useAgentSocket({
    serverUrl: AGENT_BACKEND_URL,
    userId: userId,
    sessionId: sessionId || "",
  });

  // Track previous connection status to detect reconnections
  const prevStatusRef = useRef<typeof status>("disconnected");

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Reconnect when sessionId changes
  useEffect(() => {
    if (sessionId && status === "connected") {
      // Socket is already connected, no need to reconnect
      // The next message will use the new sessionId
    }
  }, [sessionId, status]);

  // Fetch missed messages on reconnection
  useEffect(() => {
    const wasDisconnected = prevStatusRef.current === "disconnected" || prevStatusRef.current === "error";
    const isNowConnected = status === "connected";

    // Update ref for next comparison
    prevStatusRef.current = status;

    // If we just reconnected, fetch any messages we missed while offline
    if (wasDisconnected && isNowConnected && userId) {
      console.log("[companion-chat] Reconnected - fetching missed messages");

      // Fetch recent messages to catch anything sent while offline
      getRecentMessages(userId, 20)
        .then(({ messages: recentMessages }) => {
          if (recentMessages.length > 0) {
            console.log(`[companion-chat] Found ${recentMessages.length} recent messages, merging...`);

            // Convert to socket format and merge with existing messages
            const formattedMessages: SocketChatMessage[] = recentMessages.map((msg) => ({
              id: msg.id,
              role: msg.senderType === "user" ? "user" : "agent",
              content: msg.content,
              timestamp: msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now(),
              isStreaming: false,
              sessionId: msg.sessionId,
            }));

            // Update historical messages (will be merged with socket messages via useMemo)
            setHistoricalMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.id));
              const newMessages = formattedMessages.filter((m) => !existingIds.has(m.id));

              if (newMessages.length > 0) {
                console.log(`[companion-chat] Added ${newMessages.length} missed messages`);
                toast.success(`Loaded ${newMessages.length} new message${newMessages.length > 1 ? 's' : ''}`);
              }

              // Combine and sort by timestamp
              const allMessages = [...prev, ...recentMessages.filter(rm => {
                const existsInPrev = prev.some(p => p.id === rm.id);
                return !existsInPrev;
              })];

              return allMessages.sort((a, b) =>
                new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
              );
            });
          }
        })
        .catch((error) => {
          console.error("[companion-chat] Failed to fetch missed messages:", error);
        });
    }
  }, [status, userId]);

  // ==========================================================================
  // Message Merging
  // ==========================================================================

  // Merge historical and socket messages, deduplicate by ID
  const allMessages = useMemo(() => {
    // Convert historical messages to socket format
    const historicalFormatted: SocketChatMessage[] = historicalMessages.map((msg) => ({
      id: msg.id,
      role: msg.senderType === "user" ? "user" : "agent",
      content: msg.content,
      timestamp: msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now(),
      isStreaming: false,
    }));

    // Combine and deduplicate
    const messageMap = new Map<string, SocketChatMessage>();

    for (const msg of historicalFormatted) {
      messageMap.set(msg.id, msg);
    }

    for (const msg of socketMessages) {
      messageMap.set(msg.id, msg);
    }

    // Sort by timestamp
    return Array.from(messageMap.values()).sort(
      (a, b) => a.timestamp - b.timestamp
    );
  }, [historicalMessages, socketMessages]);

  // Check if there's a streaming message
  const isStreaming = useMemo(() => {
    return allMessages.some((msg) => msg.isStreaming);
  }, [allMessages]);

  // ==========================================================================
  // Tool Activity Detection
  // ==========================================================================

  // ==========================================================================
  // Smart Scroll
  // ==========================================================================

  // Check if user is near bottom
  const checkScrollPosition = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const threshold = 100;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    setIsNearBottom(distanceFromBottom < threshold);
  }, []);

  // Auto-scroll when near bottom and new messages arrive
  useEffect(() => {
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setHasNewMessage(false);
    } else if (allMessages.length > 0) {
      // User is scrolled up, show indicator
      setHasNewMessage(true);
    }
  }, [allMessages, isNearBottom]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setHasNewMessage(false);
  }, []);

  // ==========================================================================
  // Connection Status Effects
  // ==========================================================================

  // Show toasts for connection status changes
  useEffect(() => {
    if (status === "error") {
      toast.error("Connection issue - reconnecting...");
    } else if (status === "connected" && pendingMessages.length > 0) {
      // Send queued messages on reconnect
      for (const msg of pendingMessages) {
        socketSendMessage(msg);
      }
      setPendingMessages([]);
      toast.success("Connected - sending queued messages");
    }
  }, [status, pendingMessages, socketSendMessage]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  // Send message
  const handleSendMessage = useCallback(
    async (message: string) => {
      // If no session exists, create one first
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        const newSession = await createSession(userId);
        if (!newSession) {
          toast.error("Failed to start conversation");
          return;
        }
        currentSessionId = newSession.id;
        setSessionId(currentSessionId);
        setSessions((prev) => [newSession, ...prev]);
      }

      // If not connected, queue the message
      if (status !== "connected") {
        setPendingMessages((prev) => [...prev, message]);
        toast.info("Message will be sent when connected");
        return;
      }

      // Pass sessionId explicitly in case state hasn't updated yet
      socketSendMessage(message, currentSessionId);
    },
    [sessionId, userId, status, socketSendMessage]
  );

  // Switch session
  const handleSessionSelect = useCallback(
    async (newSessionId: string) => {
      if (newSessionId === sessionId) return;

      setIsLoadingMessages(true);
      setSessionId(newSessionId);
      setShowChat(true);
      setShowMobileSidebar(false);

      // Clear socket messages when switching sessions
      clearSocketMessages();

      try {
        const messages = await getSessionMessages(newSessionId, userId);
        setHistoricalMessages(messages);
      } catch (error) {
        console.error("Error loading messages:", error);
        toast.error("Failed to load messages");
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [sessionId, userId, clearSocketMessages]
  );

  // New VIZA AI chat
  const handleNewLabsAiChat = useCallback(() => {
    setSessionId(null);
    setHistoricalMessages([]);
    clearSocketMessages();
    setShowChat(true);
    setShowMobileSidebar(false);
    setInput("");
  }, [clearSocketMessages]);

  // New Care Team chat
  const handleNewCareTeamChat = useCallback(() => {
    toast.info("Coming soon");
  }, []);

  // Back to selection view
  const handleBack = useCallback(() => {
    setShowChat(false);
  }, []);

  // VIZA AI card click
  const handleLabsAiClick = useCallback(() => {
    setShowChat(true);
  }, []);

  // Care Team card click
  const handleCareTeamClick = useCallback(() => {
    toast.info("Coming soon");
  }, []);

  // Fill input with suggested prompt
  const handlePromptClick = useCallback((prompt: string) => {
    setInput(prompt);
  }, []);

  // Toggle debug panel
  const handleToggleDebug = useCallback(() => {
    setShowDebug((prev) => !prev);
  }, []);

  // ==========================================================================
  // Escalation Detection
  // ==========================================================================

  // Watch for escalation events in logs
  useEffect(() => {
    const lastLog = logs[logs.length - 1];
    if (lastLog?.eventType === "escalation") {
      toast.info("Your support team has been notified about this conversation");
    }
  }, [logs]);

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div className="min-h-[calc(100vh-9rem)] xl:min-h-[calc(100vh-8rem)] -mx-4 sm:-mx-6 md:-mx-10 xl:-mx-20 -mt-4 bg-[#fafafa] relative">
      {/* Desktop Sidebar */}
      <SessionSidebar
        sessions={sessions}
        activeSessionId={sessionId}
        onSessionSelect={handleSessionSelect}
        onNewLabsAiChat={handleNewLabsAiChat}
        onNewCareTeamChat={handleNewCareTeamChat}
        isLoading={isLoadingSessions}
      />

      {/* Main Content */}
      <main className="min-h-full flex flex-col">
        <AnimatePresence mode="wait">
          {!showChat ? (
            /* Selection View */
            <motion.div
              key="selection"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-6 sm:py-8"
            >
              <div className="w-full max-w-[520px] flex flex-col items-center">
                {/* Greeting */}
                <h1 className="text-2xl sm:text-[28px] font-medium text-gray-900 mb-6 sm:mb-8 text-center">
                  Hi, how can we help you?
                </h1>

                {/* Choice Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full mb-6 sm:mb-8">
                  {/* Labs AI Card */}
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleLabsAiClick}
                    className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 cursor-pointer hover:border-[#c1785d] hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-2.5">
                      <div className="text-[#c1785d] text-xl">✻</div>
                      <div className="flex items-center gap-1 text-[11px] text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>Immediate</span>
                      </div>
                    </div>
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-0.5">
                      Ask your <span className="text-[#c1785d]">VIZA AI</span>
                    </h3>
                    <p className="text-sm text-gray-500">
                      Simple questions, advice and guidance
                    </p>
                  </motion.div>

                  {/* Care Team Card */}
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCareTeamClick}
                    className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 cursor-pointer hover:border-gray-300 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-2.5">
                      <div className="flex -space-x-1.5">
                        <div className="w-6 h-6 rounded-full bg-amber-200 border-2 border-white" />
                        <div className="w-6 h-6 rounded-full bg-rose-200 border-2 border-white" />
                        <div className="w-6 h-6 rounded-full bg-stone-300 border-2 border-white" />
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>&lt;24h on weekdays</span>
                      </div>
                    </div>
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-0.5">
                      Ask your <span className="font-semibold">Care Team</span>
                    </h3>
                    <p className="text-sm text-gray-500">
                      Complex topics and customer service
                    </p>
                  </motion.div>
                </div>

                {/* Input Field */}
                <div className="w-full mb-4">
                  <ChatInput
                    onSend={(message) => {
                      handleLabsAiClick();
                      setTimeout(() => handleSendMessage(message), 100);
                    }}
                    disabled={status !== "connected"}
                    isConnecting={status === "connecting"}
                    placeholder="Ask anything..."
                  />
                </div>

                {/* Suggested Prompts */}
                <div className="flex flex-wrap gap-2 justify-center mb-6">
                  {suggestedPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handlePromptClick(prompt)}
                      className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-gray-200 bg-white text-xs sm:text-sm text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Disclaimer */}
              <div className="mt-auto pt-6 sm:pt-8 px-4">
                <p className="text-[10px] sm:text-xs text-gray-400 text-center max-w-md leading-relaxed">
                  Your VIZA AI is not intended to replace professional legal or
                  immigration advice. Always seek the advice of a licensed
                  immigration professional for any legal questions.
                </p>
              </div>
            </motion.div>
          ) : (
            /* Chat View */
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col items-center px-4 sm:px-6 py-6 sm:py-8 min-h-[calc(100vh-12rem)]"
            >
              <div className="w-full max-w-[520px] flex flex-col flex-1">
                {/* Chat Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleBack}
                      className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
                      aria-label="Back to selection"
                    >
                      <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div className="flex items-center gap-2">
                      <div className="text-[#c1785d] text-lg">✻</div>
                      <h2 className="text-lg font-medium text-gray-900">
                        VIZA AI
                      </h2>
                      <ConnectionStatus status={status} />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Debug toggle */}
                    <button
                      onClick={handleToggleDebug}
                      className={`p-2 rounded-full transition-colors ${
                        showDebug
                          ? "bg-[#c1785d]/10 text-[#c1785d]"
                          : "hover:bg-gray-100 text-gray-500"
                      }`}
                      aria-label="Toggle debug panel"
                    >
                      <Bug className="w-5 h-5" />
                    </button>

                    {/* Mobile menu */}
                    <Sheet
                      open={showMobileSidebar}
                      onOpenChange={setShowMobileSidebar}
                    >
                      <SheetTrigger asChild>
                        <button
                          className="lg:hidden p-2 rounded-full hover:bg-gray-100 transition-colors"
                          aria-label="Open menu"
                        >
                          <Menu className="w-5 h-5 text-gray-600" />
                        </button>
                      </SheetTrigger>
                      <SheetContent side="left" className="w-72 p-0">
                        <SheetTitle className="sr-only">Chat History</SheetTitle>
                        <div className="flex flex-col h-full pt-6">
                          <div className="px-4 pb-4 border-b">
                            <h2 className="text-xl font-semibold text-gray-900">
                              Concierge
                            </h2>
                          </div>
                          <div className="flex-1 overflow-y-auto p-4">
                            {/* Session list in mobile sheet */}
                            {sessions.map((session) => (
                              <button
                                key={session.id}
                                onClick={() => handleSessionSelect(session.id)}
                                className={`w-full text-left text-sm py-2 px-2 rounded mb-1 ${
                                  sessionId === session.id
                                    ? "bg-[#c1785d]/10 text-[#c1785d]"
                                    : "text-gray-600 hover:bg-gray-50"
                                }`}
                              >
                                {session.firstMessagePreview || "New conversation"}
                              </button>
                            ))}
                          </div>
                        </div>
                      </SheetContent>
                    </Sheet>
                  </div>
                </div>

                {/* Messages Area */}
                <div
                  ref={messagesContainerRef}
                  onScroll={checkScrollPosition}
                  className="flex-1 overflow-y-auto space-y-4 mb-6 relative"
                >
                  {/* Loading skeleton */}
                  {isLoadingMessages && (
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <Skeleton className="h-20 w-3/4 rounded-xl" />
                      </div>
                      <div className="flex justify-end">
                        <Skeleton className="h-12 w-2/3 rounded-xl" />
                      </div>
                      <div className="flex gap-3">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <Skeleton className="h-16 w-1/2 rounded-xl" />
                      </div>
                    </div>
                  )}

                  {/* Welcome message when no messages */}
                  {!isLoadingMessages && allMessages.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, duration: 0.3 }}
                      className="flex gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#c1785d]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[#c1785d] text-sm">✻</span>
                      </div>
                      <div className="bg-white rounded-xl rounded-tl-md border border-gray-100 px-4 py-3 max-w-[85%] shadow-sm">
                        <p className="text-gray-800 text-sm sm:text-base">
                          Hello! I&apos;m your VIZA AI assistant. I can help
                          you navigate your visa application, answer questions
                          about required documents, and guide you through each step.
                        </p>
                        <p className="text-gray-800 text-sm sm:text-base mt-2">
                          What would you like to know today?
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/* Messages */}
                  {!isLoadingMessages &&
                    allMessages
                      .filter(
                        (msg) =>
                          !(msg.isStreaming && msg.role === "agent" && msg.content === "")
                      )
                      .map((msg) => (
                        <ChatMessage
                          key={msg.id}
                          role={msg.role === "user" ? "user" : "agent"}
                          content={msg.content}
                          timestamp={msg.timestamp}
                        />
                      ))}

                  {/* Thinking indicator */}
                  {isStreaming &&
                    allMessages[allMessages.length - 1]?.content === "" && (
                      <ThinkingIndicator />
                    )}

                  {/* Scroll anchor */}
                  <div ref={messagesEndRef} />
                </div>

                {/* New message indicator */}
                {hasNewMessage && !isNearBottom && (
                  <button
                    onClick={scrollToBottom}
                    className="absolute bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1.5 bg-[#c1785d] text-white text-sm rounded-full shadow-lg hover:bg-[#a86249] transition-colors"
                  >
                    <ChevronDown className="w-4 h-4" />
                    New message
                  </button>
                )}

                {/* Chat Input */}
                <ChatInput
                  onSend={handleSendMessage}
                  disabled={status !== "connected" || isStreaming}
                  isConnecting={status === "connecting"}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Debug Panel (lazy loaded) */}
      {showDebug && (
        <DebugPanel
          isOpen={showDebug}
          onClose={() => setShowDebug(false)}
          logs={logs}
          onClearLogs={clearLogs}
          status={status}
        />
      )}
    </div>
  );
}
