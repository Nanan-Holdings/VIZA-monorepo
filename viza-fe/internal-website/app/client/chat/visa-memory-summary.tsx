"use client";

import { useEffect, useState } from "react";
import { Pencil, Save, Trash2, UserRoundCheck, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type {
  VisaChatMemory,
  VisaChatMemorySnapshot,
} from "@/app/actions/companion-sessions";

export type EditableMemory = Pick<
  VisaChatMemory,
  | "passportCountryIso3"
  | "passportType"
  | "residenceCountry"
  | "destinationCountries"
  | "mainDestination"
  | "tripPurpose"
  | "stayLengthDays"
>;

interface VisaMemorySummaryProps {
  snapshot: VisaChatMemorySnapshot | null;
  disabled?: boolean;
  onSave: (value: EditableMemory) => Promise<void>;
  onClear: () => Promise<void>;
  onSavePassport: (value: EditableMemory) => Promise<void>;
}

function editableMemory(state: VisaChatMemory): EditableMemory {
  return {
    passportCountryIso3: state.passportCountryIso3,
    passportType: state.passportType,
    residenceCountry: state.residenceCountry,
    destinationCountries: state.destinationCountries,
    mainDestination: state.mainDestination,
    tripPurpose: state.tripPurpose,
    stayLengthDays: state.stayLengthDays,
  };
}

export function VisaMemorySummary({
  snapshot,
  disabled,
  onSave,
  onClear,
  onSavePassport,
}: VisaMemorySummaryProps) {
  const t = useTranslations("chat");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<EditableMemory | null>(
    snapshot ? editableMemory(snapshot.state) : null
  );

  useEffect(() => {
    if (!editing) {
      setDraft(snapshot ? editableMemory(snapshot.state) : null);
    }
  }, [editing, snapshot]);

  if (!snapshot || !draft) return null;

  const chips = [
    [t("memoryPassport"), snapshot.state.passportCountryIso3],
    [t("memoryResidence"), snapshot.state.residenceCountry],
    [
      t("memoryDestination"),
      snapshot.state.destinationCountries.join(", ") ||
        snapshot.state.mainDestination,
    ],
    [t("memoryPurpose"), snapshot.state.tripPurpose],
    [
      t("memoryDays"),
      snapshot.state.stayLengthDays
        ? String(snapshot.state.stayLengthDays)
        : null,
    ],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  const run = async (action: () => Promise<void>) => {
    setSaving(true);
    try {
      await action();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto mt-1 w-full max-w-[760px] rounded-2xl border border-[#03346E]/10 bg-[#f7faff] px-3 py-2 text-xs text-[#03346E]">
      <div className="flex items-center gap-2">
        <span className="font-medium">{t("memoryTitle")}</span>
        {!editing && (
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {chips.length > 0 ? (
              chips.map(([label, value]) => (
                <span
                  className="rounded-full bg-white px-2 py-1 text-[11px] shadow-sm"
                  key={label}
                >
                  {label}: {value}
                </span>
              ))
            ) : (
              <span className="text-[#03346E]/55">{t("memoryEmpty")}</span>
            )}
          </div>
        )}
        <button
          aria-label={editing ? t("memoryCancel") : t("memoryEdit")}
          className="ml-auto rounded-full p-1.5 hover:bg-white"
          disabled={disabled || saving}
          onClick={() => setEditing((value) => !value)}
          type="button"
        >
          {editing ? (
            <X className="h-3.5 w-3.5" />
          ) : (
            <Pencil className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {editing && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <input
            aria-label={t("memoryPassport")}
            className="rounded-lg border bg-white px-2 py-1.5 uppercase"
            maxLength={3}
            onChange={(event) =>
              setDraft({
                ...draft,
                passportCountryIso3:
                  event.target.value.toUpperCase() || null,
              })
            }
            placeholder={t("memoryPassport")}
            value={draft.passportCountryIso3 ?? ""}
          />
          <input
            aria-label={t("memoryResidence")}
            className="rounded-lg border bg-white px-2 py-1.5"
            onChange={(event) =>
              setDraft({
                ...draft,
                residenceCountry: event.target.value || null,
              })
            }
            placeholder={t("memoryResidence")}
            value={draft.residenceCountry ?? ""}
          />
          <input
            aria-label={t("memoryDestination")}
            className="rounded-lg border bg-white px-2 py-1.5"
            onChange={(event) => {
              const destinations = event.target.value
                .split(",")
                .map((value) =>
                  value.trim().toLowerCase().replace(/\s+/g, "_")
                )
                .filter(Boolean);
              setDraft({
                ...draft,
                destinationCountries: destinations,
                mainDestination: destinations[0] ?? null,
              });
            }}
            placeholder={t("memoryDestination")}
            value={draft.destinationCountries.join(", ")}
          />
          <input
            aria-label={t("memoryPurpose")}
            className="rounded-lg border bg-white px-2 py-1.5"
            onChange={(event) =>
              setDraft({ ...draft, tripPurpose: event.target.value || null })
            }
            placeholder={t("memoryPurpose")}
            value={draft.tripPurpose ?? ""}
          />
          <input
            aria-label={t("memoryDays")}
            className="rounded-lg border bg-white px-2 py-1.5"
            min={1}
            onChange={(event) =>
              setDraft({
                ...draft,
                stayLengthDays: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
            placeholder={t("memoryDays")}
            type="number"
            value={draft.stayLengthDays ?? ""}
          />
          <div className="col-span-2 flex flex-wrap gap-1.5 sm:col-span-5">
            <button
              className="flex items-center gap-1 rounded-lg bg-[#03346E] px-2 py-1.5 text-white"
              disabled={saving}
              onClick={() => run(() => onSave(draft))}
              type="button"
            >
              <Save className="h-3.5 w-3.5" />
              {t("memorySave")}
            </button>
            <button
              className="flex items-center gap-1 rounded-lg border bg-white px-2 py-1.5"
              disabled={saving || !draft.passportCountryIso3}
              onClick={() => run(() => onSavePassport(draft))}
              type="button"
            >
              <UserRoundCheck className="h-3.5 w-3.5" />
              {t("memorySavePassport")}
            </button>
            <button
              className="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1.5 text-red-600"
              disabled={saving}
              onClick={() => run(onClear)}
              type="button"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("memoryClear")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
