"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  WarningCircle as AlertCircle,
  CheckCircle as CheckCircle2,
  CircleNotch as Loader2,
  Plus,
  SlidersHorizontal as Settings2,
  Trash as Trash2,
  UserCircle as UserRound,
} from "@phosphor-icons/react";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { Alert, AlertDescription, AlertIcon, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  createTeamCompanion,
  deleteTeamCompanion,
  listTeamCompanions,
  type TeamCompanionSummary,
} from "@/app/actions/application-group";
import {
  getFrequentTravelers,
  type FrequentTravelerSummary,
} from "@/app/actions/client-settings";
import { FrequentTravelerProfileFields } from "@/components/application-steps/frequent-traveler-profile-fields";
import type { FrequentTravelerInput } from "@/lib/frequent-traveler-profile";

export interface TeamStepProps {
  applicationId: string | null;
  country: string;
  visaType: string;
  returnTo: string;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: () => void;
  initialNotice?: TeamStepNotice;
}

type NoticeTone = "success" | "error";

export type TeamStepNotice = {
  tone: NoticeTone;
  message: string;
};

const EMPTY_FORM: FrequentTravelerInput = {
  fullName: "",
  surname: "",
  surnameZh: "",
  surnameEn: "",
  givenNames: "",
  givenNamesZh: "",
  givenNamesEn: "",
  dateOfBirth: "",
  birthCountry: "",
  birthProvinceOrState: "",
  birthProvinceOrStateZh: "",
  birthProvinceOrStateEn: "",
  birthCity: "",
  birthCityZh: "",
  birthCityEn: "",
  gender: "",
  nationality: "",
  occupation: "",
  occupationZh: "",
  occupationEn: "",
  address: "",
  addressZh: "",
  addressEn: "",
  passportNumber: "",
  passportIssueDate: "",
  passportExpiryDate: "",
  passportIssuingCountry: "",
  email: "",
  phone: "",
  wechat: "",
};

function obfuscatePassport(value: string | null) {
  if (!value) return null;
  if (value.length <= 4) return value;
  return `**${value.slice(-4)}`;
}

function statusKey(status?: string | null) {
  switch ((status ?? "draft").toLowerCase()) {
    case "submitted":
      return "submitted";
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "in_progress":
      return "in_progress";
    case "ready_for_submission":
      return "ready_for_submission";
    default:
      return "draft";
  }
}

export function TeamStep({
  applicationId,
  country,
  visaType,
  returnTo,
  submitLabel,
  submitting,
  onSubmit,
  initialNotice,
}: TeamStepProps) {
  const router = useRouter();
  const t = useTranslations("application.team");
  const tTravelers = useTranslations("settings.travelers");

  const [loading, setLoading] = useState(true);
  const [companions, setCompanions] = useState<TeamCompanionSummary[]>([]);
  const [frequentTravelers, setFrequentTravelers] = useState<FrequentTravelerSummary[]>([]);
  const [notice, setNotice] = useState<TeamStepNotice | null>(initialNotice ?? null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FrequentTravelerInput>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const hasCompanions = companions.length > 0;

  const sortedFrequent = useMemo(
    () => [...frequentTravelers].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")),
    [frequentTravelers],
  );
  const companionProfileIds = useMemo(
    () => new Set(companions.map((companion) => companion.applicantId)),
    [companions],
  );

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!applicationId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const [companionResult, travelerResult] = await Promise.all([
        listTeamCompanions(applicationId),
        getFrequentTravelers(),
      ]);

      if (!mounted) return;

      if (companionResult.ok) {
        setCompanions(companionResult.companions ?? []);
        setNotice((current) => (current?.tone === "error" ? null : current));
      } else {
        setNotice({ tone: "error", message: t("loadError") });
      }

      if (travelerResult.success) {
        setFrequentTravelers(travelerResult.travelers);
      }

      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [applicationId, t]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setDialogError(null);
  }

  function updateField(field: keyof FrequentTravelerInput, value: string) {
    setDialogError(null);
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function openCompanionForm(companionApplicationId: string) {
    const url = new URL("/client/application/long-form", window.location.origin);
    url.searchParams.set("applicationId", companionApplicationId);
    url.searchParams.set("country", country);
    url.searchParams.set("visaType", visaType);
    url.searchParams.set("returnTo", returnTo);
    router.push(url.toString().replace(window.location.origin, ""));
  }

  async function handleCreateFromTraveler(travelerId: string) {
    if (!applicationId) {
      setDialogError(t("noApplication"));
      return;
    }
    setCreating(true);
    setNotice(null);
    setDialogError(null);
    const result = await createTeamCompanion({ applicationId, travelerId });
    setCreating(false);
    if (!result.ok || !result.applicationId) {
      setDialogError(result.reason ?? t("createError"));
      return;
    }
    setDialogOpen(false);
    resetForm();
    await openCompanionForm(result.applicationId);
  }

  async function handleCreateFromCustom() {
    if (!applicationId) {
      setDialogError(t("noApplication"));
      return;
    }
    setCreating(true);
    setNotice(null);
    setDialogError(null);
    const result = await createTeamCompanion({ applicationId, traveler: form });
    setCreating(false);
    if (!result.ok || !result.applicationId) {
      setDialogError(result.reason ?? t("createError"));
      return;
    }
    setDialogOpen(false);
    resetForm();
    await openCompanionForm(result.applicationId);
  }

  async function handleDelete(companionApplicationId: string) {
    if (!applicationId) return;
    setDeletingId(companionApplicationId);
    setNotice(null);
    const result = await deleteTeamCompanion(applicationId, companionApplicationId);
    setDeletingId(null);
    if (!result.ok) {
      setNotice({ tone: "error", message: t("deleteError") });
      return;
    }
    setCompanions((current) => current.filter((companion) => companion.applicationId !== companionApplicationId));
    setNotice({ tone: "success", message: t("deleted") });
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm leading-6 text-muted-foreground sm:text-base">{t("subtitle")}</p>

      {notice ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm font-medium ${
            notice.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
          role="status"
          aria-live="polite"
        >
          {notice.message}
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">{t("savedProfilesTitle")}</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("savedProfilesSubtitle")}</p>
          </div>
          <Link
            href="/client/settings/travelers"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-brand-500 px-4 text-sm font-medium text-brand-500 transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            <Settings2 className="h-4 w-4" />
            {t("manageProfiles")}
          </Link>
        </div>

        {loading ? (
          <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t("loadingProfiles")}
          </div>
        ) : sortedFrequent.length > 0 ? (
          <div className="divide-y border-y border-border/70">
            {sortedFrequent.map((traveler) => {
              const alreadyAdded = companionProfileIds.has(traveler.id);
              return (
                <button
                  key={traveler.id}
                  type="button"
                  onClick={() => handleCreateFromTraveler(traveler.id)}
                  className="flex w-full items-center gap-3 px-1 py-4 text-left transition-colors hover:bg-brand-50/60 disabled:cursor-default disabled:opacity-70 disabled:hover:bg-transparent"
                  disabled={creating || alreadyAdded}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                    <UserRound className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{traveler.fullName}</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {traveler.nationality || tTravelers("notSet")} · {obfuscatePassport(traveler.passportNumber) || tTravelers("notSet")}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-brand-500">
                    {alreadyAdded ? t("profileAdded") : t("selectProfile")}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="bg-muted/40 px-4 py-5 text-center">
            <p className="text-sm text-muted-foreground">{t("dialog.noFrequent")}</p>
            <Button
              type="button"
              variant="link"
              className="mt-1 h-auto p-0 text-brand-500"
              onClick={() => setDialogOpen(true)}
            >
              {t("addFirstProfile")}
            </Button>
          </div>
        )}
      </section>

      <section className="border-t border-border/70 pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">{t("listTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("listSubtitle")}</p>
          </div>
          <Button type="button" variant="outline" className="h-10 rounded-full" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("addNew")}
          </Button>
        </div>

        {loading ? (
          <div className="mt-6 flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t("loading")}
          </div>
        ) : hasCompanions ? (
          <div className="mt-5 divide-y border-y border-border/70">
            {companions.map((companion) => (
              <div key={companion.applicationId} className="flex flex-col gap-3 px-1 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                    <UserRound className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-foreground">{companion.fullName}</p>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>{companion.nationality || tTravelers("notSet")}</span>
                      <span>{obfuscatePassport(companion.passportNumber) || tTravelers("notSet")}</span>
                      <span>{companion.dateOfBirth || tTravelers("notSet")}</span>
                    </div>
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t(`status.${statusKey(companion.status)}`)}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-full"
                    onClick={() => openCompanionForm(companion.applicationId)}
                  >
                    {t("edit")}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        disabled={deletingId === companion.applicationId}
                      >
                        {deletingId === companion.applicationId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        {t("delete")}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
                        <AlertDialogDescription>{t("deleteDialog.description")}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("deleteDialog.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => handleDelete(companion.applicationId)}
                        >
                          {t("deleteDialog.confirm")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 flex flex-col items-center gap-3 bg-muted/40 px-4 py-6 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <UserRound className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-semibold text-foreground">{t("emptyTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("emptyDescription")}</p>
            </div>
          </div>
        )}
      </section>

      <div className="flex flex-col gap-4 border-t border-border/70 pt-5">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
          <p className="text-sm leading-6 text-muted-foreground">{t("hint")}</p>
        </div>
        <BrandActionButton
          type="button"
          className="w-full"
          onClick={onSubmit}
          disabled={!applicationId}
          loading={submitting}
          loadingText={t("submitting")}
        >
          {submitLabel}
        </BrandActionButton>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(next) => {
          setDialogOpen(next);
          if (next) setDialogError(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("dialog.title")}</DialogTitle>
            <p className="text-sm text-muted-foreground">{t("dialog.subtitle")}</p>
          </DialogHeader>

          {dialogError ? (
            <Alert variant="destructive">
              <AlertIcon variant="destructive" />
              <AlertTitle>{t("dialog.errorTitle")}</AlertTitle>
              <AlertDescription>
                <p>{dialogError}</p>
              </AlertDescription>
            </Alert>
          ) : null}

          <FrequentTravelerProfileFields value={form} onFieldChange={updateField} />

          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full"
              onClick={() => {
                resetForm();
                setDialogOpen(false);
              }}
            >
              {t("dialog.cancel")}
            </Button>
            <Button
              type="button"
              className="h-10 rounded-full"
              onClick={handleCreateFromCustom}
              disabled={creating}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("dialog.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
