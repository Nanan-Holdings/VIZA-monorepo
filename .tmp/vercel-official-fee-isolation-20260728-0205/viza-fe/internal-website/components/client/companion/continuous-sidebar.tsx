"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "motion/react";
import { X, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MessagePreview, SearchResult } from "@/app/actions/companion-sessions";

// Icon Components
function LucidePanelLeft() {
  return (
    <div className="relative shrink-0 size-[32px] cursor-pointer hover:opacity-70 transition-opacity">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
        <path
          d="M12 5.33331H6.66671C5.93033 5.33331 5.33337 5.93027 5.33337 6.66665V25.3333C5.33337 26.0697 5.93033 26.6666 6.66671 26.6666H12M12 5.33331V26.6666M12 5.33331H25.3334C26.0698 5.33331 26.6667 5.93027 26.6667 6.66665V25.3333C26.6667 26.0697 26.0698 26.6666 25.3334 26.6666H12"
          stroke="black"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity="0.35"
          strokeWidth="2.66667"
        />
      </svg>
    </div>
  );
}

function LucideUsersRound() {
  return (
    <div className="relative shrink-0 size-[21px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 21.3333 21.3333">
        <path
          d="M14.2222 17.7778C14.2222 15.8149 12.4037 14.2222 10.1481 14.2222C7.89258 14.2222 6.07407 15.8149 6.07407 17.7778M17.7778 14.8519C17.7778 13.5127 16.7847 12.3579 15.4074 11.9654M3.55556 14.8519C3.55556 13.5127 4.54866 12.3579 5.92593 11.9654M12.5185 8.14815C12.5185 9.45725 11.4572 10.5185 10.1481 10.5185C8.83906 10.5185 7.77778 9.45725 7.77778 8.14815C7.77778 6.83906 8.83906 5.77778 10.1481 5.77778C11.4572 5.77778 12.5185 6.83906 12.5185 8.14815ZM16.0741 7.40741C16.0741 8.38644 15.2809 9.17963 14.3019 9.17963C13.3228 9.17963 12.5296 8.38644 12.5296 7.40741C12.5296 6.42837 13.3228 5.63519 14.3019 5.63519C15.2809 5.63519 16.0741 6.42837 16.0741 7.40741ZM7.77778 7.40741C7.77778 8.38644 6.98459 9.17963 6.00556 9.17963C5.02652 9.17963 4.23333 8.38644 4.23333 7.40741C4.23333 6.42837 5.02652 5.63519 6.00556 5.63519C6.98459 5.63519 7.77778 6.42837 7.77778 7.40741Z"
          stroke="#989898"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.77333"
        />
      </svg>
    </div>
  );
}

interface ContinuousSidebarProps {
  // Checkpoints
  checkpoints: MessagePreview[];
  isLoadingCheckpoints: boolean;
  hasMoreCheckpoints: boolean;
  onLoadMoreCheckpoints: () => void;
  onCheckpointClick: (messageId: string) => void;

  // Search
  searchQuery: string;
  searchResults: SearchResult[];
  isSearching: boolean;
  hasMoreSearchResults: boolean;
  searchTotalCount: number;
  onSearch: (query: string) => void;
  onLoadMoreSearchResults: () => void;
  onClearSearch: () => void;
  onSearchResultClick: (messageId: string) => void;

  // Actions
  onNewCareTeamChat: () => void;
  onToggleCollapse: () => void;

  // State
  collapsed: boolean;
}

/**
 * Format relative timestamp for sidebar
 */
function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "";

  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  // For older, show date
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Highlight search term in text
 */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return text;

  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-yellow-200 text-inherit rounded px-0.5">
        {text.slice(index, index + query.length)}
      </mark>
      {text.slice(index + query.length)}
    </>
  );
}

/**
 * Continuous sidebar for Labs AI mode
 * Shows flat list of message checkpoints with search
 */
export function ContinuousSidebar({
  checkpoints,
  isLoadingCheckpoints,
  hasMoreCheckpoints,
  onLoadMoreCheckpoints,
  onCheckpointClick,
  searchQuery,
  searchResults,
  isSearching,
  hasMoreSearchResults,
  searchTotalCount,
  onSearch,
  onLoadMoreSearchResults,
  onClearSearch,
  onSearchResultClick,
  onNewCareTeamChat,
  onToggleCollapse,
  collapsed,
}: ContinuousSidebarProps) {
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (localSearchQuery !== searchQuery) {
        onSearch(localSearchQuery);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [localSearchQuery, searchQuery, onSearch]);

  // Handle search activation
  const handleSearchClick = useCallback(() => {
    setIsSearchActive(true);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }, []);

  // Handle search clear
  const handleClearSearch = useCallback(() => {
    setLocalSearchQuery("");
    setIsSearchActive(false);
    onClearSearch();
  }, [onClearSearch]);

  // Handle scroll for infinite loading
  const handleScroll = useCallback(() => {
    if (!listRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

    if (isNearBottom) {
      if (searchQuery && hasMoreSearchResults && !isSearching) {
        onLoadMoreSearchResults();
      } else if (!searchQuery && hasMoreCheckpoints && !isLoadingCheckpoints) {
        onLoadMoreCheckpoints();
      }
    }
  }, [
    searchQuery,
    hasMoreSearchResults,
    isSearching,
    hasMoreCheckpoints,
    isLoadingCheckpoints,
    onLoadMoreSearchResults,
    onLoadMoreCheckpoints,
  ]);

  // Show search results or checkpoints
  const showingSearch = searchQuery.length >= 3;

  return (
    <motion.aside
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, width: collapsed ? 80 : 320 }}
      transition={{ duration: 0.3 }}
      className="hidden lg:flex flex-col fixed left-0 top-32 xl:top-32 bottom-0 z-10"
    >
      <div className="flex flex-col gap-6 pl-4 sm:pl-6 md:pl-10 xl:pl-20 pr-4 pt-6 h-full origin-top-left scale-[1.2] -translate-x-[16px]">
        {/* Header */}
        <div className="flex items-center justify-between w-full gap-6">
          {!collapsed && (
            <p className="font-medium text-[28px] text-[#454545] tracking-[-1.12px] leading-[1.3]">
              Concierge
            </p>
          )}
          <button
            onClick={onToggleCollapse}
            className="hover:opacity-70 transition-opacity"
            aria-label="Toggle sidebar"
          >
            <LucidePanelLeft />
          </button>
        </div>

        {/* Action Buttons - Hidden when collapsed */}
        {!collapsed && (
          <div className="flex flex-col w-full">
            {/* Search - Toggle between button and input */}
            {isSearchActive ? (
              <div className="relative flex items-center mb-2">
                <Search className="absolute left-2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={localSearchQuery}
                  onChange={(e) => setLocalSearchQuery(e.target.value)}
                  placeholder="Search messages..."
                  className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#c1785d] focus:border-transparent"
                />
                <button
                  onClick={handleClearSearch}
                  className="absolute right-2 p-0.5 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleSearchClick}
                className="w-full flex items-center gap-[10.667px] py-2 px-2 -mx-2 rounded-md text-[#989898] hover:text-gray-700 hover:bg-gray-100/60 transition-colors"
              >
                <div className="relative shrink-0 size-[21px]">
                  <Search className="w-full h-full" strokeWidth={1.77} />
                </div>
                <span className="font-medium text-[16px] leading-[1.6] whitespace-nowrap">
                  Search chats
                </span>
              </button>
            )}

            {/* New Care Team chat */}
            <button
              onClick={onNewCareTeamChat}
              className="w-full flex items-center gap-[10.667px] py-2 px-2 -mx-2 rounded-md text-[#989898] hover:text-gray-700 hover:bg-gray-100/60 transition-colors"
            >
              <LucideUsersRound />
              <span className="font-medium text-[16px] leading-[1.6] whitespace-nowrap">
                New Care Team chat
              </span>
            </button>
          </div>
        )}

        {/* Checkpoints / Search Results List */}
        {!collapsed && (
          <div
            ref={listRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto -mr-4 pr-4"
          >
            {showingSearch ? (
              // Search Results
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500">
                    {searchTotalCount} result{searchTotalCount !== 1 ? "s" : ""}
                  </p>
                </div>

                {searchResults.length === 0 && !isSearching ? (
                  <p className="text-sm text-gray-400 py-4 text-center">
                    No messages found for &quot;{searchQuery}&quot;
                  </p>
                ) : (
                  searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => onSearchResultClick(result.id)}
                      className="w-full text-left p-2 rounded-md hover:bg-gray-50 transition-colors group"
                    >
                      <div className="text-sm text-gray-700 line-clamp-2">
                        {highlightMatch(result.matchSnippet, searchQuery)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">
                          {formatRelativeTime(result.createdAt)}
                        </span>
                        <span className="text-xs text-gray-300">
                          {result.senderType === "user" ? "You" : "AI"}
                        </span>
                      </div>
                    </button>
                  ))
                )}

                {isSearching && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  </div>
                )}
              </div>
            ) : (
              // Checkpoints
              <div className="flex flex-col gap-1">
                {checkpoints.length === 0 && !isLoadingCheckpoints ? (
                  <p className="text-sm text-gray-400 py-4">No conversations yet</p>
                ) : (
                  checkpoints.map((checkpoint, index) => (
                    <div key={checkpoint.id}>
                      {/* Conversation separator */}
                      {checkpoint.isFirstInSession && index > 0 && (
                        <div className="h-px bg-gray-200 my-3" />
                      )}
                      <button
                        onClick={() => onCheckpointClick(checkpoint.id)}
                        className="w-full text-left py-1.5 px-2 -mx-2 rounded-md hover:bg-gray-100/60 transition-colors group"
                      >
                        <p className="text-sm text-[rgba(0,0,0,0.35)] truncate group-hover:text-gray-600 transition-colors">
                          {checkpoint.content}
                        </p>
                        <p className="text-xs text-gray-300 mt-0.5 group-hover:text-gray-400 transition-colors">
                          {formatRelativeTime(checkpoint.createdAt)}
                        </p>
                      </button>
                    </div>
                  ))
                )}

                {isLoadingCheckpoints && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.aside>
  );
}
