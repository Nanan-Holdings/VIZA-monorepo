"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// Stubs — referral system removed during domain migration
type ReferralHistoryItem = { id: string; email: string; status: string; invited_at: string };
type ReferralStats = { totalSent: number; friendsJoined: number; totalEarned: number };
async function getReferralHistory() {
  return { success: true as const, data: [] as ReferralHistoryItem[] };
}
async function getReferralStats() {
  return { success: false as const, data: undefined as ReferralStats | undefined };
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

const statusConfig: Record<
  string,
  { label: string; bgColor: string; textColor: string }
> = {
  pending: {
    label: "Pending",
    bgColor: "rgba(0,0,0,0.04)",
    textColor: "#989898",
  },
  signed_up: {
    label: "Signed up",
    bgColor: "rgba(59,130,246,0.1)",
    textColor: "#3b82f6",
  },
  completed: {
    label: "Purchased",
    bgColor: "rgba(245,158,11,0.1)",
    textColor: "#f59e0b",
  },
  rewarded: {
    label: "Rewarded",
    bgColor: "rgba(34,197,94,0.1)",
    textColor: "#22c55e",
  },
};

export function InviteHistory() {
  const [history, setHistory] = useState<ReferralHistoryItem[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [historyResult, statsResult] = await Promise.all([
        getReferralHistory(),
        getReferralStats(),
      ]);

      if (historyResult.success && historyResult.data) {
        setHistory(historyResult.data);
      }
      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <motion.div
        className="flex items-center justify-center py-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <Loader2 className="h-6 w-6 animate-spin text-[#989898]" />
      </motion.div>
    );
  }

  if (history.length === 0) {
    return null; // Don't show anything if no invites yet
  }

  return (
    <motion.div
      className="invite-friends-shell content-stretch flex flex-col gap-4 sm:gap-6 items-start relative shrink-0 w-full"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
    >
      <p className="font-medium leading-[1.3] not-italic relative shrink-0 text-[28px] text-black tracking-[-1.12px] w-full">
        Your Invites
      </p>

      {/* Stats summary */}
      {stats && (
        <div className="flex flex-wrap gap-4 sm:gap-6 w-full">
          <div className="flex items-center gap-2">
            <span className="text-[14px] text-[#989898]">Sent</span>
            <span className="text-[16px] font-medium text-[#3d3d3d]">
              {stats.totalSent}
            </span>
          </div>
          <div className="h-4 w-px bg-[#efefef]" />
          <div className="flex items-center gap-2">
            <span className="text-[14px] text-[#989898]">Friends joined</span>
            <span className="text-[16px] font-medium text-[#3d3d3d]">
              {stats.friendsJoined}
            </span>
          </div>
          <div className="h-4 w-px bg-[#efefef]" />
          <div className="flex items-center gap-2">
            <span className="text-[14px] text-[#989898]">Earned</span>
            <span className="text-[16px] font-medium text-[#03346E]">
              {formatCurrency(stats.totalEarned)}
            </span>
          </div>
        </div>
      )}

      {/* Invite list */}
      <div className="w-full rounded-[12px] border border-[#efefef] bg-white overflow-hidden">
        {history.map((item, index) => {
          const config = statusConfig[item.status] || statusConfig.pending;
          return (
            <motion.div
              key={item.id}
              className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[#efefef] last:border-b-0"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * index, duration: 0.3 }}
            >
              <div className="flex flex-col gap-1 min-w-0">
                <p className="text-[15px] font-medium text-[#3d3d3d] truncate">
                  {item.email}
                </p>
                <p className="text-[13px] text-[#989898]">
                  {formatRelativeDate(item.invited_at)}
                </p>
              </div>
              <span
                className="shrink-0 ml-3 rounded-full px-3 py-1 text-[13px] font-medium"
                style={{
                  backgroundColor: config.bgColor,
                  color: config.textColor,
                }}
              >
                {config.label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
