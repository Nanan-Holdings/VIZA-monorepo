"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  getMessagePreviews,
  getMessagesAroundCheckpoint,
  loadMoreHistory,
  searchMessages,
  getRecentMessages,
  type Message,
  type MessagePreview,
  type SearchResult,
} from "@/app/actions/companion-sessions";
import type { ChatMessage as SocketChatMessage } from "@/types/agent-test";

interface UseContinuousChatOptions {
  userId: string;
  sessionId?: string | null;
  initialMessages?: Message[];
  initialCheckpoints?: MessagePreview[];
  isFirstTimeUser?: boolean;
}

interface UseContinuousChatReturn {
  // Messages
  messages: SocketChatMessage[];
  isLoadingMore: boolean;
  hasMoreHistory: boolean;
  reachedHistoryBoundary: boolean;
  isFirstTimeUser: boolean;

  // Sidebar
  checkpoints: MessagePreview[];
  isLoadingCheckpoints: boolean;
  hasMoreCheckpoints: boolean;

  // Search
  searchQuery: string;
  searchResults: SearchResult[];
  isSearching: boolean;
  hasMoreSearchResults: boolean;
  searchTotalCount: number;

  // Actions
  loadMoreHistory: () => Promise<void>;
  loadMoreCheckpoints: () => Promise<void>;
  jumpToMessage: (messageId: string) => Promise<void>;
  search: (query: string) => Promise<void>;
  loadMoreSearchResults: () => Promise<void>;
  clearSearch: () => void;
  addSocketMessage: (message: SocketChatMessage) => void;
  refreshCheckpoints: () => Promise<void>;
  prependHistoricalMessages: (messages: Message[]) => void;
  resetHistoryState: (hasMore?: boolean) => void;
  setMessages: React.Dispatch<React.SetStateAction<SocketChatMessage[]>>;

  // State
  jumpTargetId: string | null;
  clearJumpTarget: () => void;
  showScrollToBottom: boolean;
  setShowScrollToBottom: (show: boolean) => void;
  showNewMessageButton: boolean;
  setShowNewMessageButton: (show: boolean) => void;

  // Session tracking for conversation separators
  currentSessionId: string | null;
  setCurrentSessionId: (id: string | null) => void;
  pendingNewConversation: boolean;
  setPendingNewConversation: (pending: boolean) => void;
}

/**
 * Custom hook for managing continuous chat state
 * Handles messages, checkpoints, search, and navigation
 */
export function useContinuousChat({
  userId,
  sessionId,
  initialMessages = [],
  initialCheckpoints = [],
  isFirstTimeUser: initialIsFirstTimeUser = false,
}: UseContinuousChatOptions): UseContinuousChatReturn {
  // Messages state
  const [messages, setMessages] = useState<SocketChatMessage[]>(() =>
    initialMessages.map((msg) => ({
      id: msg.id,
      role: msg.senderType === "user" ? "user" : "agent",
      content: msg.content,
      timestamp: msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now(),
      isStreaming: false,
      sessionId: msg.sessionId,
    }))
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [reachedHistoryBoundary, setReachedHistoryBoundary] = useState(false);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(initialIsFirstTimeUser);

  // Checkpoints state
  const [checkpoints, setCheckpoints] = useState<MessagePreview[]>(initialCheckpoints);
  const [isLoadingCheckpoints, setIsLoadingCheckpoints] = useState(false);
  const [hasMoreCheckpoints, setHasMoreCheckpoints] = useState(true);
  const checkpointOffsetRef = useRef(initialCheckpoints.length);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasMoreSearchResults, setHasMoreSearchResults] = useState(false);
  const [searchTotalCount, setSearchTotalCount] = useState(0);
  const searchOffsetRef = useRef(0);

  // Navigation state
  const [jumpTargetId, setJumpTargetId] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [showNewMessageButton, setShowNewMessageButton] = useState(false);

  // Session tracking
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    initialMessages.length > 0 ? initialMessages[initialMessages.length - 1].sessionId : null
  );
  const [pendingNewConversation, setPendingNewConversation] = useState(false);

  // Load more history (infinite scroll up)
  const handleLoadMoreHistory = useCallback(async () => {
    if (isLoadingMore || !hasMoreHistory || reachedHistoryBoundary) return;

    const oldestMessage = messages[0];
    if (!oldestMessage?.timestamp) return;

    setIsLoadingMore(true);

    try {
      const result = await loadMoreHistory(
        userId,
        new Date(oldestMessage.timestamp).toISOString(),
        20,
        sessionId
      );

      if (result.messages.length > 0) {
        const formattedMessages: SocketChatMessage[] = result.messages.map((msg) => ({
          id: msg.id,
          role: msg.senderType === "user" ? "user" : "agent",
          content: msg.content,
          timestamp: msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now(),
          isStreaming: false,
          sessionId: msg.sessionId,
        }));

        setMessages((prev) => {
          // Deduplicate by id
          const existingIds = new Set(prev.map((m) => m.id));
          const newMessages = formattedMessages.filter((m) => !existingIds.has(m.id));
          return [...newMessages, ...prev];
        });
      }

      setHasMoreHistory(result.hasMore);
      setReachedHistoryBoundary(result.reachedBoundary);
    } catch (error) {
      console.error("Error loading more history:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMoreHistory, reachedHistoryBoundary, messages, userId, sessionId]);

  // Load more checkpoints (infinite scroll in sidebar)
  const handleLoadMoreCheckpoints = useCallback(async () => {
    if (isLoadingCheckpoints || !hasMoreCheckpoints) return;

    setIsLoadingCheckpoints(true);

    try {
      const result = await getMessagePreviews(userId, {
        limit: 20,
        offset: checkpointOffsetRef.current,
      });

      if (result.previews.length > 0) {
        setCheckpoints((prev) => [...prev, ...result.previews]);
        checkpointOffsetRef.current += result.previews.length;
      }

      setHasMoreCheckpoints(result.hasMore);
    } catch (error) {
      console.error("Error loading more checkpoints:", error);
    } finally {
      setIsLoadingCheckpoints(false);
    }
  }, [isLoadingCheckpoints, hasMoreCheckpoints, userId]);

  // Jump to a specific message
  const handleJumpToMessage = useCallback(
    async (messageId: string) => {
      setIsLoadingMore(true);

      try {
        const result = await getMessagesAroundCheckpoint(userId, messageId, {
          before: 15,
          after: 15,
        });

        if (result.messages.length > 0) {
          const formattedMessages: SocketChatMessage[] = result.messages.map((msg) => ({
            id: msg.id,
            role: msg.senderType === "user" ? "user" : "agent",
            content: msg.content,
            timestamp: msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now(),
            isStreaming: false,
            sessionId: msg.sessionId,
          }));

          setMessages(formattedMessages);
          setHasMoreHistory(result.hasMoreBefore);

          // Set the jump target to highlight the message
          setJumpTargetId(messageId);

          // Clear highlight after 3 seconds
          setTimeout(() => {
            setJumpTargetId(null);
          }, 3000);
        }
      } catch (error) {
        console.error("Error jumping to message:", error);
      } finally {
        setIsLoadingMore(false);
      }
    },
    [userId]
  );

  // Search messages
  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);

      if (query.length < 3) {
        setSearchResults([]);
        setHasMoreSearchResults(false);
        setSearchTotalCount(0);
        return;
      }

      setIsSearching(true);
      searchOffsetRef.current = 0;

      try {
        const result = await searchMessages(userId, query, {
          limit: 20,
          offset: 0,
        });

        setSearchResults(result.results);
        setHasMoreSearchResults(result.hasMore);
        setSearchTotalCount(result.totalCount);
        searchOffsetRef.current = result.results.length;
      } catch (error) {
        console.error("Error searching messages:", error);
      } finally {
        setIsSearching(false);
      }
    },
    [userId]
  );

  // Load more search results
  const handleLoadMoreSearchResults = useCallback(async () => {
    if (isSearching || !hasMoreSearchResults || searchQuery.length < 3) return;

    setIsSearching(true);

    try {
      const result = await searchMessages(userId, searchQuery, {
        limit: 20,
        offset: searchOffsetRef.current,
      });

      if (result.results.length > 0) {
        setSearchResults((prev) => [...prev, ...result.results]);
        searchOffsetRef.current += result.results.length;
      }

      setHasMoreSearchResults(result.hasMore);
    } catch (error) {
      console.error("Error loading more search results:", error);
    } finally {
      setIsSearching(false);
    }
  }, [isSearching, hasMoreSearchResults, searchQuery, userId]);

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchResults([]);
    setHasMoreSearchResults(false);
    setSearchTotalCount(0);
    searchOffsetRef.current = 0;
  }, []);

  // Add a socket message (from real-time streaming)
  const handleAddSocketMessage = useCallback((message: SocketChatMessage) => {
    setMessages((prev) => {
      // Check if message already exists (by id)
      const existingIndex = prev.findIndex((m) => m.id === message.id);
      if (existingIndex >= 0) {
        // Update existing message
        const updated = [...prev];
        updated[existingIndex] = message;
        return updated;
      }
      // Add new message
      return [...prev, message];
    });
  }, []);

  // Refresh checkpoints (e.g., on page focus)
  const handleRefreshCheckpoints = useCallback(async () => {
    try {
      const result = await getMessagePreviews(userId, {
        limit: 20,
        offset: 0,
      });

      setCheckpoints(result.previews);
      checkpointOffsetRef.current = result.previews.length;
      setHasMoreCheckpoints(result.hasMore);
    } catch (error) {
      console.error("Error refreshing checkpoints:", error);
    }
  }, [userId]);

  // Prepend historical messages (for backwards compatibility)
  const handlePrependHistoricalMessages = useCallback((newMessages: Message[]) => {
    const formattedMessages: SocketChatMessage[] = newMessages.map((msg) => ({
      id: msg.id,
      role: msg.senderType === "user" ? "user" : "agent",
      content: msg.content,
      timestamp: msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now(),
      isStreaming: false,
      sessionId: msg.sessionId,
    }));

    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const uniqueNew = formattedMessages.filter((m) => !existingIds.has(m.id));
      return [...uniqueNew, ...prev];
    });
  }, []);

  const handleResetHistoryState = useCallback((hasMore: boolean = true) => {
    setHasMoreHistory(hasMore);
    setReachedHistoryBoundary(false);
    setShowScrollToBottom(false);
    setShowNewMessageButton(false);
  }, []);

  // Clear jump target
  const clearJumpTarget = useCallback(() => {
    setJumpTargetId(null);
  }, []);

  return {
    // Messages
    messages,
    isLoadingMore,
    hasMoreHistory,
    reachedHistoryBoundary,
    isFirstTimeUser,

    // Sidebar
    checkpoints,
    isLoadingCheckpoints,
    hasMoreCheckpoints,

    // Search
    searchQuery,
    searchResults,
    isSearching,
    hasMoreSearchResults,
    searchTotalCount,

    // Actions
    loadMoreHistory: handleLoadMoreHistory,
    loadMoreCheckpoints: handleLoadMoreCheckpoints,
    jumpToMessage: handleJumpToMessage,
    search: handleSearch,
    loadMoreSearchResults: handleLoadMoreSearchResults,
    clearSearch: handleClearSearch,
    addSocketMessage: handleAddSocketMessage,
    refreshCheckpoints: handleRefreshCheckpoints,
    prependHistoricalMessages: handlePrependHistoricalMessages,
    resetHistoryState: handleResetHistoryState,
    setMessages,

    // State
    jumpTargetId,
    clearJumpTarget,
    showScrollToBottom,
    setShowScrollToBottom,
    showNewMessageButton,
    setShowNewMessageButton,

    // Session tracking
    currentSessionId,
    setCurrentSessionId,
    pendingNewConversation,
    setPendingNewConversation,
  };
}
