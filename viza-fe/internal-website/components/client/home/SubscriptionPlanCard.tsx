"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, CreditCard, Sparkles } from "lucide-react";

export function SubscriptionPlanCard() {
  return (
    <motion.div
      className="basis-0 grow"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0, duration: 0.5 }}
    >
      <Link
        href="/client/subscription"
        className="backdrop-blur-md bg-[rgba(255,255,255,0.12)] flex h-[240px] w-full flex-col justify-between rounded-[12px] p-[24px] relative transition-colors hover:bg-[rgba(255,255,255,0.18)]"
      >
        <div className="absolute border border-[rgba(255,255,255,0.2)] inset-0 pointer-events-none rounded-[12px]" />
        <div className="relative flex w-full items-start justify-between gap-4">
          <div>
            <p className="font-heading font-medium leading-[1.3] text-[20px] text-white tracking-[-0.6px]">
              订阅
            </p>
            <p className="mt-1 text-[12px] leading-5 text-[rgba(255,255,255,0.58)]">
              当前方案与续费状态
            </p>
          </div>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white">
            <CreditCard className="h-4 w-4" />
          </span>
        </div>

        <div className="relative w-full space-y-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[18px] font-medium leading-tight text-white">
                体验版
              </p>
              <p className="mt-0.5 text-[13px] text-[rgba(255,255,255,0.62)]">
                续费暂未启用 · 无需付款
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[12px] font-medium text-white">
              方案设计中
            </span>
            <span className="inline-flex items-center gap-1 text-[14px] font-semibold text-white">
              查看详情
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
