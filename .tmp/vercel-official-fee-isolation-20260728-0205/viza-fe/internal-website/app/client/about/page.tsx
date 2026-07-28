// @ts-nocheck - visa fields removed during domain migration

"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { geist } from "../../fonts";
import {
  getClientAboutData,
  type UserAboutData,
} from "@/app/actions/user-profile";

// =============================================================================
// Types
// =============================================================================

interface DisplayData {
  // Profile (users table)
  sex: "M" | "F" | "";
  dateOfBirth: string;

  // Profile Data
  height: string;
  heightUnit: string;
  weight: string;
  weightUnit: string;
  waist: string;
  waistUnit: string;

  // Lifestyle
  smokingStatus: string;
  alcoholConsumption: string;
  exerciseHoursPerWeek: string;
  dietType: string;
  stressLevel: string;
  sleepHoursPerNight: string;

  // Visa
  currentItems: string;
  hormoneOptimization: string;
  thyroidInfo: string;
  diagnosedConditions: string;

  // Hormones
  menstruationStatus: string;
  currentCycleDay: string;
  hormonalBirthControl: string;
}

// =============================================================================
// Constants - Dropdown Options (for display labels)
// =============================================================================

const SEX_OPTIONS = [
  { value: "", label: "Not set" },
  { value: "M", label: "Male" },
  { value: "F", label: "Female" },
];

const SMOKING_OPTIONS = [
  { value: "", label: "Not set" },
  { value: "non_smoker", label: "Non-smoker" },
  { value: "former_smoker", label: "Former smoker" },
  { value: "current_smoker", label: "Current smoker" },
  { value: "occasional", label: "Occasional smoker" },
];

const ALCOHOL_OPTIONS = [
  { value: "", label: "Not set" },
  { value: "none", label: "None" },
  { value: "occasional", label: "Occasional (1-2 drinks/week)" },
  { value: "moderate", label: "Moderate (3-7 drinks/week)" },
  { value: "heavy", label: "Heavy (8+ drinks/week)" },
];

const DIET_OPTIONS = [
  { value: "", label: "Not set" },
  { value: "balanced", label: "Balanced" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "keto", label: "Keto" },
  { value: "paleo", label: "Paleo" },
  { value: "mediterranean", label: "Mediterranean" },
  { value: "low_carb", label: "Low Carb" },
  { value: "other", label: "Other" },
];

const SLEEP_OPTIONS = [
  { value: "", label: "Not set" },
  { value: "<5", label: "Less than 5 hours" },
  { value: "5-6", label: "5-6 hours" },
  { value: "6-7", label: "6-7 hours" },
  { value: "7-8", label: "7-8 hours" },
  { value: "8+", label: "8+ hours" },
];

const MENSTRUATION_OPTIONS = [
  { value: "", label: "Not set" },
  { value: "regular", label: "Regular" },
  { value: "irregular", label: "Irregular" },
  { value: "perimenopause", label: "Perimenopause" },
  { value: "post_menopausal", label: "Post-menopausal" },
];

const BIRTH_CONTROL_OPTIONS = [
  { value: "", label: "Not set" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

// =============================================================================
// Helper Functions
// =============================================================================

function transformApiDataToDisplay(data: UserAboutData): DisplayData {
  return {
    sex: data.biologicalSex || "",
    dateOfBirth: data.dateOfBirth || "",

    height: data.profile_data.height?.value?.toString() || "",
    heightUnit: data.profile_data.height?.unit || "cm",
    weight: data.profile_data.weight?.value?.toString() || "",
    weightUnit: data.profile_data.weight?.unit || "kg",
    waist: data.profile_data.waistCircumference?.value?.toString() || "",
    waistUnit: data.profile_data.waistCircumference?.unit || "cm",

    smokingStatus: data.lifestyle?.smokingStatus || "",
    alcoholConsumption: data.lifestyle?.alcoholConsumption || "",
    exerciseHoursPerWeek: data.lifestyle?.exerciseHoursPerWeek?.toString() || "",
    dietType: data.lifestyle?.dietType || "",
    stressLevel: data.lifestyle?.stressLevel?.toString() || "",
    sleepHoursPerNight: data.lifestyle?.sleepHoursPerNight || "",

    currentItems: data.visa?.currentItems || "",
    hormoneOptimization: data.visa?.hormoneOptimization || "",
    thyroidInfo: data.visa?.thyroidInfo || "",
    diagnosedConditions: data.visa?.diagnosedConditions || "",

    menstruationStatus: data.hormones?.menstruationStatus || "",
    currentCycleDay: data.hormones?.currentCycleDay || "",
    hormonalBirthControl:
      data.hormones?.hormonalBirthControl === true
        ? "yes"
        : data.hormones?.hormonalBirthControl === false
          ? "no"
          : "",
  };
}

function formatDateForDisplay(dateStr: string): string {
  if (!dateStr) return "Not set";
  const date = new Date(dateStr);
  const age = Math.floor(
    (Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );
  return `${date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })} (${age} years)`;
}

function getLabelFromValue(
  options: { value: string; label: string }[],
  value: string
): string {
  const option = options.find((o) => o.value === value);
  return option?.label || "Not set";
}

// =============================================================================
// Display Components (Read-only)
// =============================================================================

function DisplayValue({ value }: { value: string }) {
  return (
    <p className="text-[18px] font-medium text-[#3d3d3d] tracking-[-0.32px]">
      {value || "Not set"}
    </p>
  );
}

function DisplayValueWithUnit({ value, unit }: { value: string; unit: string }) {
  return (
    <p className="text-[18px] font-medium text-[#3d3d3d] tracking-[-0.32px]">
      {value ? `${value} ${unit}` : "Not set"}
    </p>
  );
}

// =============================================================================
// Section Components
// =============================================================================

function SectionHeading({ title }: { title: string }) {
  return (
    <motion.p
      className={`${geist.className} text-[28px] md:text-[32px] font-medium text-black tracking-tight`}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {title}
    </motion.p>
  );
}

interface FieldRowProps {
  label: string;
  children: React.ReactNode;
}

function FieldRow({ label, children }: FieldRowProps) {
  return (
    <div className="flex flex-col gap-2">
      <p
        className={`${geist.className} text-[19px] font-medium text-[#989898]`}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

interface InfoCardProps {
  children: React.ReactNode;
}

function InfoCard({ children }: InfoCardProps) {
  return (
    <motion.div
      className="w-full rounded-[12px] border border-[#efefef] bg-white p-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex flex-col gap-6">{children}</div>
    </motion.div>
  );
}

// =============================================================================
// Loading and Error States
// =============================================================================

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
// Main Component (Read-only)
// =============================================================================

export default function ClientAboutPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiData, setApiData] = useState<UserAboutData | null>(null);
  const [displayData, setDisplayData] = useState<DisplayData | null>(null);

  // Fetch data on mount
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);

      const result = await getClientAboutData();

      if (result.success && result.data) {
        setApiData(result.data);
        setDisplayData(transformApiDataToDisplay(result.data));
      } else {
        setError(result.error || "Failed to load profile data");
      }

      setIsLoading(false);
    }

    fetchData();
  }, []);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!displayData) return <ErrorState message="No data available" />;

  const biologicalSex = apiData?.biologicalSex;

  const sections = [
    { title: "Profile", show: true },
    { title: "Habits", show: true },
    { title: "Diet", show: true },
    { title: "Items", show: true },
    { title: "Hormones", show: biologicalSex === "F" },
    { title: "Recovery", show: true },
    { title: "Conditions", show: true },
  ].filter((s) => s.show);

  return (
    <div className="w-full pb-16">
      <div className="mx-auto flex max-w-[960px] flex-col gap-12 md:gap-16">
        {/* Update Info Button */}
        <div className="flex justify-end">
          <motion.button
            type="button"
            onClick={() => router.push("/client/about-me-form")}
            className="flex items-center gap-2 rounded-full border-2 border-[#c1785d] px-6 py-3 text-base font-medium text-[#c1785d] shadow-[0_10px_30px_rgba(0,0,0,0.04)] transition-all duration-200 hover:bg-[#c1785d0d]"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            Update My Info
          </motion.button>
        </div>

        {sections.map((section) => (
          <div
            key={section.title}
            className="flex flex-col gap-4"
          >
            <SectionHeading title={section.title} />

            {/* Profile Section */}
            {section.title === "Profile" && (
              <div className="flex flex-col gap-4">
                <InfoCard>
                  <FieldRow label="Biological Sex">
                    <DisplayValue value={getLabelFromValue(SEX_OPTIONS, displayData.sex)} />
                  </FieldRow>
                  <FieldRow label="Date of Birth">
                    <DisplayValue value={formatDateForDisplay(displayData.dateOfBirth)} />
                  </FieldRow>
                </InfoCard>
                <InfoCard>
                  <FieldRow label="Height">
                    <DisplayValueWithUnit value={displayData.height} unit={displayData.heightUnit} />
                  </FieldRow>
                  <FieldRow label="Weight">
                    <DisplayValueWithUnit value={displayData.weight} unit={displayData.weightUnit} />
                  </FieldRow>
                  <FieldRow label="Waist Circumference">
                    <DisplayValueWithUnit value={displayData.waist} unit={displayData.waistUnit} />
                  </FieldRow>
                </InfoCard>
              </div>
            )}

            {/* Habits Section */}
            {section.title === "Habits" && (
              <InfoCard>
                <FieldRow label="Smoking Status">
                  <DisplayValue value={getLabelFromValue(SMOKING_OPTIONS, displayData.smokingStatus)} />
                </FieldRow>
                <FieldRow label="Alcohol Consumption">
                  <DisplayValue value={getLabelFromValue(ALCOHOL_OPTIONS, displayData.alcoholConsumption)} />
                </FieldRow>
                <FieldRow label="Exercise Hours/Week">
                  <DisplayValue value={displayData.exerciseHoursPerWeek ? `${displayData.exerciseHoursPerWeek} hours` : "Not set"} />
                </FieldRow>
              </InfoCard>
            )}

            {/* Diet Section */}
            {section.title === "Diet" && (
              <InfoCard>
                <FieldRow label="Diet Type">
                  <DisplayValue value={getLabelFromValue(DIET_OPTIONS, displayData.dietType)} />
                </FieldRow>
              </InfoCard>
            )}

            {/* Items Section */}
            {section.title === "Items" && (
              <InfoCard>
                <FieldRow label="Current Items">
                  <DisplayValue value={displayData.currentItems || "None"} />
                </FieldRow>
                <FieldRow label="Hormone Optimization and dosage (if applicable)">
                  <DisplayValue value={displayData.hormoneOptimization || "Not currently using"} />
                </FieldRow>
                <FieldRow label="Thyroid Item (if applicable)">
                  <DisplayValue value={displayData.thyroidInfo || "None"} />
                </FieldRow>
              </InfoCard>
            )}

            {/* Hormones Section */}
            {section.title === "Hormones" && (
              <InfoCard>
                <FieldRow label="Menstruation Status">
                  <DisplayValue value={getLabelFromValue(MENSTRUATION_OPTIONS, displayData.menstruationStatus)} />
                </FieldRow>
                <FieldRow label="Current Cycle Day">
                  <DisplayValue value={displayData.currentCycleDay || "Not set"} />
                </FieldRow>
                <FieldRow label="Hormonal Birth Control Use">
                  <DisplayValue value={getLabelFromValue(BIRTH_CONTROL_OPTIONS, displayData.hormonalBirthControl)} />
                </FieldRow>
              </InfoCard>
            )}

            {/* Recovery Section */}
            {section.title === "Recovery" && (
              <InfoCard>
                <FieldRow label="Stress Level (1-10)">
                  <DisplayValue value={displayData.stressLevel || "Not set"} />
                </FieldRow>
                <FieldRow label="Sleep Hours/Night">
                  <DisplayValue value={getLabelFromValue(SLEEP_OPTIONS, displayData.sleepHoursPerNight)} />
                </FieldRow>
              </InfoCard>
            )}

            {/* Conditions Section */}
            {section.title === "Conditions" && (
              <InfoCard>
                <FieldRow label="Diagnosed Conditions">
                  <DisplayValue value={displayData.diagnosedConditions || "None"} />
                </FieldRow>
              </InfoCard>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
