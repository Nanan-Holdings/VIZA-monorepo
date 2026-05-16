"use client";

import { useState } from "react";
import { BilingualReviewPanel, type ReviewRow } from "@/components/application-steps/bilingual-review-panel";

const INITIAL_ROWS: ReviewRow[] = [
  {
    section: "Personal Information",
    fieldName: "surname",
    label: "Surname (family name)",
    sourceValue: "王",
    officialValue: "WANG",
    badges: ["Auto Translated"],
    warnings: ["Check that this romanized spelling matches your passport exactly."],
    editable: true,
  },
  {
    section: "Personal Information",
    fieldName: "given_names",
    label: "First name(s) / given name(s)",
    sourceValue: "小明",
    officialValue: "XIAOMING",
    badges: ["Edited"],
    warnings: ["Check that this romanized spelling matches your passport exactly."],
    editable: true,
  },
  {
    section: "Travel Document",
    fieldName: "travel_document_issue_date",
    label: "Date of issue",
    sourceValue: "2024-03-09",
    officialValue: "09/03/2024",
    badges: ["Official format"],
    warnings: ["Confirm this date is in official format: DD/MM/YYYY."],
    editable: false,
  },
  {
    section: "Trip Details",
    fieldName: "purpose_of_journey",
    label: "Main purpose of journey",
    sourceValue: "旅游",
    officialValue: "Tourism",
    badges: ["Official option"],
    warnings: [],
    editable: false,
  },
  {
    section: "Accommodation",
    fieldName: "hotel_address",
    label: "Hotel or accommodation address",
    sourceValue: "巴黎第一区里沃利街 10 号",
    officialValue: "10 Rue de Rivoli, 1st arrondissement, Paris",
    badges: ["Auto Translated"],
    warnings: [],
    editable: true,
  },
  {
    section: "Previous Travel #2",
    fieldName: "previous_visa_number__2",
    label: "Previous visa number",
    sourceValue: "SCH-2023-8891",
    officialValue: "SCH-2023-8891",
    badges: [],
    warnings: [],
    editable: false,
  },
];

export default function BilingualReviewPreviewPage() {
  const [rows, setRows] = useState<ReviewRow[]>(INITIAL_ROWS);
  const [showFailure, setShowFailure] = useState(false);
  const [retrying, setRetrying] = useState(false);

  async function retryPreview() {
    setRetrying(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setShowFailure(false);
    setRetrying(false);
  }

  function updateOfficialValue(fieldName: string, officialValue: string) {
    setRows((current) =>
      current.map((row) =>
        row.fieldName === fieldName
          ? {
              ...row,
              officialValue,
              badges: row.badges.includes("Edited")
                ? row.badges
                : [...row.badges.filter((badge) => badge !== "Auto Translated"), "Edited"],
            }
          : row,
      ),
    );
  }

  return (
    <main className="min-h-screen bg-[#fafafa] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#03346E]">
            Standalone Preview
          </p>
          <h1 className="font-heading text-3xl font-medium text-[#2f2f2f]">
            Bilingual Review Page
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-gray-600">
            This isolated page uses mock data only. It does not connect to the real application
            flow, does not submit anything, and lets you validate the side-by-side review UI safely.
          </p>
        </header>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setShowFailure((value) => !value)}
            className="rounded-md border border-[#d7e0ee] bg-white px-3 py-2 text-sm font-medium text-[#03346E] transition-colors hover:bg-[#f7faff]"
          >
            Toggle translation failure
          </button>
          <button
            type="button"
            onClick={() => setRows(INITIAL_ROWS)}
            className="rounded-md border border-[#e1e1e1] bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Reset mock edits
          </button>
        </div>

        <div className="rounded-xl border border-[#efefef] bg-white p-4 sm:p-6">
          <BilingualReviewPanel
            rows={rows}
            error={showFailure ? "Translation could not be completed automatically." : null}
            retrying={retrying}
            onRetry={() => void retryPreview()}
            onSaveOfficialValue={async (fieldName, officialValue) => {
              updateOfficialValue(fieldName, officialValue);
            }}
            onUpdated={updateOfficialValue}
          />
        </div>
      </div>
    </main>
  );
}
