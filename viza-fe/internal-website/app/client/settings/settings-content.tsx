"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { LogOut, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { geist } from "../../fonts";
import { BillingTab } from "./components/billing-tab";

// =============================================================================
// Types
// =============================================================================

type Tab = "billing" | "account";

// =============================================================================
// Account Tab (inline — email, display name, sign out)
// =============================================================================

function AccountTab({
  email,
  displayName,
  onDisplayNameChange,
  onSave,
  isSaving,
  saveMsg,
  onSignOut,
}: {
  email: string;
  displayName: string;
  onDisplayNameChange: (v: string) => void;
  onSave: () => void;
  isSaving: boolean;
  saveMsg: string;
  onSignOut: () => void;
}) {
  const t = useTranslations("settings");

  return (
    <div className="flex flex-col gap-6 sm:gap-8 w-full">
      {/* Email & Display Name */}
      <div className="flex w-full flex-col gap-4">
        <motion.p
          className={`${geist.className} text-[22px] sm:text-[26px] md:text-[32px] font-medium text-black tracking-tight`}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {t("account.title")}
        </motion.p>
        <motion.div
          className="w-full rounded-xl border border-[#efefef] bg-white p-4 sm:p-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="flex flex-col gap-6 w-full">
            {/* Email (read-only) */}
            <div className="flex flex-col gap-2">
              <p className={`${geist.className} text-[16px] sm:text-[18px] font-medium text-[#989898]`}>
                {t("account.email")}
              </p>
              <input
                type="email"
                value={email}
                readOnly
                className="w-full rounded-[10px] border border-[#efefef] bg-[rgba(239,239,239,0.25)] px-4 py-2.5 text-[16px] sm:text-[18px] font-medium text-[#989898] tracking-[-0.32px] cursor-not-allowed outline-none"
              />
            </div>

            {/* Display Name */}
            <div className="flex flex-col gap-2">
              <p className={`${geist.className} text-[16px] sm:text-[18px] font-medium text-[#989898]`}>
                {t("account.displayName")}
              </p>
              <input
                type="text"
                value={displayName}
                onChange={(e) => onDisplayNameChange(e.target.value)}
                placeholder={t("account.namePlaceholder")}
                className="w-full rounded-[10px] border border-[#d9d9d9] bg-white px-4 py-2.5 text-[16px] sm:text-[18px] font-medium text-[#3d3d3d] tracking-[-0.32px] outline-none focus:border-[#03346E] transition-colors"
              />
            </div>

            {/* Save */}
            <div className="flex items-center gap-3">
              <motion.button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                className="rounded-full bg-[#03346E] px-6 py-2.5 text-[14px] sm:text-[15px] font-medium text-white disabled:opacity-60"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                {isSaving ? t("account.saving") : t("account.saveChanges")}
              </motion.button>
              {saveMsg && (
                <span
                  className={`text-[14px] font-medium ${
                    saveMsg.includes("Failed") ? "text-red-500" : "text-green-600"
                  }`}
                >
                  {saveMsg}
                </span>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Sign Out */}
      <div className="flex w-full flex-col gap-4">
        <motion.p
          className={`${geist.className} text-[22px] sm:text-[26px] md:text-[32px] font-medium text-black tracking-tight`}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
        >
          {t("signOut.title")}
        </motion.p>
        <motion.div
          className="w-full rounded-xl border border-[#efefef] bg-white p-4 sm:p-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
        >
          <div className="flex flex-col gap-4">
            <p className="text-[16px] sm:text-[18px] font-medium text-[#989898] tracking-[-0.32px]">
              {t("signOut.description")}
            </p>
            <motion.button
              type="button"
              onClick={onSignOut}
              className="flex w-fit items-center gap-2 rounded-full border-2 border-red-300 px-5 py-2.5 text-[14px] sm:text-[15px] font-medium text-red-500 transition-all duration-200 hover:bg-red-50"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <LogOut className="h-4 w-4" />
              {t("signOut.button")}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Settings Content
// =============================================================================

export function SettingsContent() {
  const router = useRouter();
  const t = useTranslations("settings");
  const [activeTab, setActiveTab] = useState<Tab>("billing");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveMsg, setSaveMsg] = useState("");
  const [userId, setUserId] = useState("");

  const TABS: { id: Tab; label: string }[] = [
    { id: "billing", label: t("tabs.billing") },
    { id: "account", label: t("tabs.account") },
  ];

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/client/login");
        return;
      }
      setEmail(data.user.email ?? "");
      setUserId(data.user.id);
      supabase
        .from("applicant_profiles")
        .select("full_name")
        .eq("auth_user_id", data.user.id)
        .single()
        .then(({ data: profile }) => {
          if (profile?.full_name) setDisplayName(profile.full_name);
          setIsLoading(false);
        });
    });
  }, [router]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMsg("");
    const supabase = createClient();
    const { error } = await supabase
      .from("applicant_profiles")
      .update({ full_name: displayName })
      .eq("auth_user_id", userId);
    setIsSaving(false);
    setSaveMsg(error ? t("account.failedToSave") : t("account.saved"));
    setTimeout(() => setSaveMsg(""), 3000);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/client/login");
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-[#03346E]" />
        <p className="text-lg text-[#989898]">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4 sm:pt-8">
        {/* Page heading */}
        <div className="mb-8 sm:mb-10">
          <h1 className="font-heading font-medium leading-[1.15] text-[28px] tracking-[-1px] text-[#3d3d3d] sm:text-[34px] sm:tracking-[-1.2px] lg:text-[40px] lg:tracking-[-1.6px]">
            {t("title")}
          </h1>
        </div>

        {/* Tab bar */}
        <div className="inline-flex items-center gap-[6px] rounded-[12px] bg-[rgba(239,239,239,0.65)] p-[5px] mb-8 sm:mb-10">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                "relative rounded-[8px] px-6 sm:px-8 py-[10px] text-[15px] sm:text-[16px] font-medium tracking-[-0.24px] transition-all duration-200",
                activeTab === tab.id
                  ? "bg-white text-[#3d3d3d]"
                  : "text-[#989898] hover:text-[#3d3d3d]",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "billing" && <BillingTab />}
            {activeTab === "account" && (
              <AccountTab
                email={email}
                displayName={displayName}
                onDisplayNameChange={setDisplayName}
                onSave={handleSave}
                isSaving={isSaving}
                saveMsg={saveMsg}
                onSignOut={handleSignOut}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
