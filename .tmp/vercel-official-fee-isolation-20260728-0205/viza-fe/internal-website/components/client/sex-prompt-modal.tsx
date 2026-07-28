// @ts-nocheck - needs refactoring after domain migration

"use client";

/**
 * Sex Prompt Modal
 *
 * A modal that prompts the user to provide their biological sex
 * when it's missing from their profile. This is needed for accurate
 * reference range selection in lab reports.
 *
 * The modal is shown once when user views their lab report and
 * their sex is not set. After selection, the profile is updated
 * and the page is reloaded to show personalized reference ranges.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, User, Loader2 } from "lucide-react";
import { updateClientProfile } from "@/app/actions/user-profile";

interface SexPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SexPromptModal({ isOpen, onClose, onSuccess }: SexPromptModalProps) {
  const [selectedSex, setSelectedSex] = useState<"M" | "F" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, handleEscape]);

  const handleSubmit = async () => {
    if (!selectedSex) {
      setError("Please select an option");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await updateClientProfile({ sex: selectedSex });

      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || "Failed to update profile");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="bg-[#1a1f2e] rounded-xl max-w-md w-full p-6 shadow-xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#59bf86]/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-[#59bf86]" />
                  </div>
                  <h2 className="text-xl font-semibold text-white">
                    Complete Your Profile
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="space-y-4">
                <p className="text-gray-300 text-sm leading-relaxed">
                  To show you the most accurate reference ranges for your lab results,
                  we need to know your biological sex. Reference ranges can differ
                  significantly between males and females.
                </p>

                {/* Sex Selection */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setSelectedSex("M")}
                    className={`flex-1 py-4 px-4 rounded-lg border-2 transition-all ${
                      selectedSex === "M"
                        ? "border-[#59bf86] bg-[#59bf86]/10"
                        : "border-white/10 hover:border-white/20 bg-white/5"
                    }`}
                  >
                    <span
                      className={`text-lg font-medium ${
                        selectedSex === "M" ? "text-[#59bf86]" : "text-white"
                      }`}
                    >
                      Male
                    </span>
                  </button>
                  <button
                    onClick={() => setSelectedSex("F")}
                    className={`flex-1 py-4 px-4 rounded-lg border-2 transition-all ${
                      selectedSex === "F"
                        ? "border-[#59bf86] bg-[#59bf86]/10"
                        : "border-white/10 hover:border-white/20 bg-white/5"
                    }`}
                  >
                    <span
                      className={`text-lg font-medium ${
                        selectedSex === "F" ? "text-[#59bf86]" : "text-white"
                      }`}
                    >
                      Female
                    </span>
                  </button>
                </div>

                {/* Error Message */}
                {error && (
                  <p className="text-red-400 text-sm text-center">{error}</p>
                )}

                {/* Submit Button */}
                <button
                  onClick={handleSubmit}
                  disabled={!selectedSex || isSubmitting}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-all mt-4 ${
                    selectedSex && !isSubmitting
                      ? "bg-[#59bf86] hover:bg-[#4aa974] text-white"
                      : "bg-white/10 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    "Continue"
                  )}
                </button>

                {/* Skip Link */}
                <button
                  onClick={onClose}
                  className="w-full py-2 text-gray-400 text-sm hover:text-gray-300 transition-colors"
                >
                  Skip for now (results may be less accurate)
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
