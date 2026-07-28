// @ts-nocheck - needs refactoring after domain migration

"use client";

import { motion } from "motion/react";
import { useEffect, useState, useTransition } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { geist } from "../../../fonts";
import { getClientProfileData, updateClientAddress } from "@/app/actions/settings";

// =============================================================================
// Types
// =============================================================================

interface ProfileData {
  personalInfo: {
    firstName: string;
    lastName: string;
    biologicalSex: "M" | "F" | "";
    dateOfBirth: string;
    bio: string;
  };
  contact: {
    email: string;
    phone: string;
    address: string;
    isDefaultAddress: boolean;
  };
}

// =============================================================================
// Helper Components
// =============================================================================

function SectionHeading({ title }: { title: string }) {
  return (
    <motion.p
      className={`${geist.className} text-[22px] sm:text-[26px] md:text-[32px] font-medium text-black tracking-tight`}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {title}
    </motion.p>
  );
}

function DisplayValue({ value }: { value: string }) {
  return (
    <p className="text-[16px] sm:text-[18px] font-medium text-[#3d3d3d] tracking-[-0.32px]">
      {value || "Not set"}
    </p>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className={`${geist.className} text-[16px] sm:text-[18px] font-medium text-[#989898]`}>
        {label}
      </p>
      {children}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="h-12 w-12 animate-spin text-brand" />
      <p className="text-lg text-muted-foreground">Loading your profile...</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <AlertCircle className="h-12 w-12 text-red-500" />
      <p className="text-lg text-red-600">{message}</p>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ProfileTab() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [addressInput, setAddressInput] = useState("");
  const [addressError, setAddressError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);

      const result = await getClientProfileData();

      if (result.success && result.data) {
        setProfileData(result.data);
      } else {
        setError(result.error || "Failed to load profile data");
      }

      setIsLoading(false);
    }

    fetchData();
  }, []);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!profileData) return <ErrorState message="No data available" />;

  const { personalInfo, contact } = profileData;
  const hasDob = Boolean(personalInfo.dateOfBirth);
  const dobDate = hasDob ? new Date(personalInfo.dateOfBirth) : null;
  const validDobDate = dobDate && !Number.isNaN(dobDate.getTime()) ? dobDate : null;
  const dobFormatted = validDobDate
    ? validDobDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Not set";
  const age = validDobDate
    ? Math.floor((Date.now() - validDobDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;
  const fullName = `${personalInfo.firstName} ${personalInfo.lastName}`.trim();

  function handleAddressSave() {
    setAddressError(null);

    startTransition(async () => {
      const result = await updateClientAddress(addressInput);

      if (!result.success || !result.address) {
        setAddressError(result.error || "Failed to save address");
        return;
      }

      const savedAddress = result.address;

      setProfileData((previous) => {
        if (!previous) return previous;
        return {
          ...previous,
          contact: {
            ...previous.contact,
            address: savedAddress,
            isDefaultAddress: true,
          },
        };
      });
      setIsAddingAddress(false);
      setAddressInput("");
    });
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8 w-full">
      {/* Personal Information */}
      <div className="flex w-full flex-col gap-4">
        <SectionHeading title="Personal Information" />
        <motion.div
          className="w-full rounded-xl border border-[#efefef] bg-white p-4 sm:p-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="flex flex-col gap-6 w-full">
            <FieldRow label="Name">
              <DisplayValue value={fullName} />
            </FieldRow>
            <FieldRow label="Date of Birth">
              <DisplayValue value={age === null ? dobFormatted : `${dobFormatted} (${age} years)`} />
            </FieldRow>
          </div>
        </motion.div>
      </div>

      {/* Contact */}
      <div className="flex w-full flex-col gap-4">
        <SectionHeading title="Contact" />
        <motion.div
          className="w-full rounded-xl border border-[#efefef] bg-white p-4 sm:p-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="flex flex-col gap-6 w-full">
            <FieldRow label="Email">
              <DisplayValue value={contact.email} />
            </FieldRow>
            <FieldRow label="Phone">
              <DisplayValue value={contact.phone} />
            </FieldRow>
            <FieldRow label="Addresses">
              <div className="bg-[rgba(239,239,239,0.25)] rounded-[8px] w-full">
                <div className="flex flex-col gap-[10px] p-[16px]">
                  <div className="flex items-center gap-[10px] flex-wrap">
                    <p className={`${geist.className} text-[14px] sm:text-[16px] font-medium text-[#3d3d3d]`}>
                      {contact.address}
                    </p>
                    {contact.isDefaultAddress && (
                      <p className={`${geist.className} text-[14px] sm:text-[16px] font-medium text-[#a8644d]`}>
                        · Default address
                      </p>
                    )}
                  </div>
                  <p className={`${geist.className} text-[14px] sm:text-[16px] font-medium text-[#989898]`}>
                    {contact.address ? "Default address" : "No address on file"}
                  </p>

                  {!contact.address && !isAddingAddress && (
                    <motion.button
                      type="button"
                      className="bg-black text-white px-4 py-2 rounded-full font-sans font-medium text-[14px] tracking-[-0.2px] w-fit"
                      whileHover={{ scale: 1.03, backgroundColor: "#333" }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        setIsAddingAddress(true);
                        setAddressError(null);
                      }}
                    >
                      Add address
                    </motion.button>
                  )}

                  {!contact.address && isAddingAddress && (
                    <div className="flex flex-col gap-3 w-full max-w-[520px]">
                      <input
                        type="text"
                        value={addressInput}
                        onChange={(event) => setAddressInput(event.target.value)}
                        placeholder="Enter your address"
                        className="w-full rounded-[10px] border border-[#d9d9d9] bg-white px-4 py-2.5 text-[14px] text-[#3d3d3d] outline-none focus:border-[#c1785d]"
                        disabled={isPending}
                      />
                      {addressError && (
                        <p className="text-[13px] text-red-600">{addressError}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleAddressSave}
                          disabled={isPending}
                          className="bg-black text-white px-4 py-2 rounded-full text-[13px] font-medium disabled:opacity-60"
                        >
                          {isPending ? "Saving..." : "Save address"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingAddress(false);
                            setAddressInput("");
                            setAddressError(null);
                          }}
                          disabled={isPending}
                          className="px-4 py-2 rounded-full text-[13px] font-medium border border-[#d9d9d9] text-[#3d3d3d] disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </FieldRow>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
