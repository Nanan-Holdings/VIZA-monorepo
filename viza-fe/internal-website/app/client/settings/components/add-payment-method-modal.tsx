"use client";

import { motion, AnimatePresence } from "motion/react";
import { X, CreditCard } from "lucide-react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

interface AddPaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientSecret?: string;
  onSuccess?: () => void;
}

export function AddPaymentMethodModal({
  isOpen,
  onClose,
}: AddPaymentMethodModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[22px] sm:text-[26px] font-medium text-black tracking-tight">
                  Payment Methods
                </h2>
                <button
                  onClick={onClose}
                  className="text-[#989898] hover:text-[#3d3d3d] transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <Empty className="py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CreditCard />
                  </EmptyMedia>
                  <EmptyTitle>Coming soon</EmptyTitle>
                  <EmptyDescription>
                    Payment method management will be available here soon.
                    Contact support for billing updates.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full px-4 py-2.5 border border-[#efefef] rounded-full font-medium text-[#3d3d3d] text-[14px] hover:bg-[#f5f5f5] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
