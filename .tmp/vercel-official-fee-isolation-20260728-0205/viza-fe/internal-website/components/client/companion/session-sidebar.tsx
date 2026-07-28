"use client";

import { motion } from "motion/react";
import { Search, PenSquare, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Session } from "@/app/actions/companion-sessions";

interface SessionSidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onNewLabsAiChat: () => void;
  onNewCareTeamChat: () => void;
  isLoading?: boolean;
}

/**
 * Group sessions by time period
 */
function groupSessions(sessions: Session[]) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const recent: Session[] = [];
  const older: Session[] = [];

  for (const session of sessions) {
    const createdAt = session.createdAt ? new Date(session.createdAt) : new Date();
    if (createdAt >= sevenDaysAgo) {
      recent.push(session);
    } else {
      older.push(session);
    }
  }

  return { recent, older };
}

/**
 * Get display text for session (first message preview or fallback)
 */
function getSessionDisplay(session: Session): string {
  if (session.firstMessagePreview) {
    return session.firstMessagePreview.length >= 30
      ? `${session.firstMessagePreview}...`
      : session.firstMessagePreview;
  }
  return "New conversation";
}

export function SessionSidebar({
  sessions,
  activeSessionId,
  onSessionSelect,
  onNewLabsAiChat,
  onNewCareTeamChat,
  isLoading = false,
}: SessionSidebarProps) {
  const { recent, older } = groupSessions(sessions);

  return (
    <motion.aside
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="hidden lg:flex flex-col fixed left-0 top-32 xl:top-32 bottom-0 w-64 xl:w-72 bg-white border-r border-gray-100 z-10"
    >
      {/* Sidebar Header */}
      <div className="pl-4 sm:pl-6 md:pl-10 xl:pl-20 pr-4 pt-6 pb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold text-gray-900">Concierge</h2>
          <button
            onClick={onNewLabsAiChat}
            className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            aria-label="New chat"
          >
            <PenSquare className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Sidebar Content */}
      <div className="flex-1 overflow-y-auto pl-4 sm:pl-6 md:pl-10 xl:pl-20 pr-4 pb-4">
        {/* Search (placeholder) */}
        <button className="w-full flex items-center gap-2.5 text-gray-500 text-sm mb-3 py-2 hover:text-gray-700 transition-all duration-200">
          <Search className="w-4 h-4" />
          <span>Search chats</span>
        </button>

        {/* New Chat Options */}
        <div className="space-y-0.5 mb-5">
          <button
            onClick={onNewLabsAiChat}
            className="w-full flex items-center gap-2.5 text-gray-700 text-sm py-2 hover:text-[#c1785d] transition-all duration-200"
          >
            <PenSquare className="w-4 h-4" />
            <span>New Labs AI chat</span>
          </button>
          <button
            onClick={onNewCareTeamChat}
            className="w-full flex items-center gap-2.5 text-gray-700 text-sm py-2 hover:text-gray-900 transition-all duration-200"
          >
            <Users className="w-4 h-4" />
            <span>New Care Team chat</span>
          </button>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-16 mb-2" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}

        {/* Sessions list */}
        {!isLoading && (
          <>
            {/* Recent Section */}
            {recent.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-400 mb-1.5">Recent</p>
                <div className="space-y-0.5">
                  {recent.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => onSessionSelect(session.id)}
                      className={cn(
                        "w-full text-left text-sm py-1.5 px-2 -mx-2 rounded truncate transition-all duration-200",
                        activeSessionId === session.id
                          ? "bg-[#c1785d]/10 text-[#c1785d] font-medium"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      )}
                    >
                      {getSessionDisplay(session)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Last 30 Days Section */}
            {older.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1.5">
                  Last 30 days
                </p>
                <div className="space-y-0.5">
                  {older.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => onSessionSelect(session.id)}
                      className={cn(
                        "w-full text-left text-sm py-1.5 px-2 -mx-2 rounded truncate transition-all duration-200",
                        activeSessionId === session.id
                          ? "bg-[#c1785d]/10 text-[#c1785d] font-medium"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      )}
                    >
                      {getSessionDisplay(session)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {sessions.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">
                No conversations yet
              </p>
            )}
          </>
        )}
      </div>
    </motion.aside>
  );
}
