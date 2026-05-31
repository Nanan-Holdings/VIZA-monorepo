"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  type FrequentTravelerInput,
  type FrequentTravelerSummary,
} from "@/app/actions/client-settings";

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
  dateOfBirth: "",
  nationality: "",
  passportNumber: "",
  passportExpiryDate: "",
  email: "",
  phone: "",
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

function inputClass() {
  return "h-11 rounded-lg border bg-white px-3 text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
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
  const [activeTab, setActiveTab] = useState<"frequent" | "custom">("frequent");
  const [form, setForm] = useState<FrequentTravelerInput>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const hasCompanions = companions.length > 0;

  const sortedFrequent = useMemo(
    () => [...frequentTravelers].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")),
    [frequentTravelers],
  );

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!applicationId) return;
      setLoading(true);
      const [companionResult, travelerResult] = await Promise.all([
        listTeamCompanions(applicationId),
        getFrequentTravelers(),
      ]);

      if (!mounted) return;

      if (companionResult.ok) {
        setCompanions(companionResult.companions ?? []);
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
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-foreground sm:text-2xl">{t("title")}</h2>
        <p className="text-sm text-muted-foreground sm:text-base">{t("subtitle")}</p>
      </header>

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

      <div className="rounded-xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">{t("listTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("listSubtitle")}</p>
          </div>
          <Button type="button" className="h-10 rounded-full" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("add")}
          </Button>
        </div>

        {loading ? (
          <div className="mt-6 flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t("loading")}
          </div>
        ) : hasCompanions ? (
          <div className="mt-5 divide-y">
            {companions.map((companion) => (
              <div key={companion.applicationId} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/60 px-4 py-6 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <UserRound className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-semibold text-foreground">{t("emptyTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("emptyDescription")}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-800">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <p>{t("hint")}</p>
        </div>
        <Button
          type="button"
          className="h-11 rounded-full bg-brand-500 text-white hover:bg-brand-600"
          onClick={onSubmit}
          disabled={submitting || !applicationId}
        >
          {submitting ? t("submitting") : submitLabel}
        </Button>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(next) => {
          setDialogOpen(next);
          if (next) setDialogError(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("dialog.title")}</DialogTitle>
            <p className="text-sm text-muted-foreground">{t("dialog.subtitle")}</p>
          </DialogHeader>

          {dialogError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {dialogError}
            </div>
          ) : null}

          <Tabs value={activeTab} onValueChange={(next) => setActiveTab(next as "frequent" | "custom")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="frequent">{t("dialog.tabs.frequent")}</TabsTrigger>
              <TabsTrigger value="custom">{t("dialog.tabs.custom")}</TabsTrigger>
            </TabsList>

            <TabsContent value="frequent" className="mt-4 space-y-3">
              {sortedFrequent.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
                  {t("dialog.noFrequent")}
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedFrequent.map((traveler) => (
                    <button
                      key={traveler.id}
                      type="button"
                      onClick={() => handleCreateFromTraveler(traveler.id)}
                      className="w-full rounded-lg border border-border/60 bg-white p-4 text-left transition hover:border-brand-200 hover:bg-brand-50"
                      disabled={creating}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{traveler.fullName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {traveler.nationality || tTravelers("notSet")} | {obfuscatePassport(traveler.passportNumber) || tTravelers("notSet")}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-brand-500">{t("dialog.select")}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="custom" className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-foreground">{tTravelers("fields.fullName")}</span>
                  <input
                    className={inputClass()}
                    value={form.fullName}
                    onChange={(event) => updateField("fullName", event.target.value)}
                    placeholder={tTravelers("placeholders.fullName")}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-foreground">{tTravelers("fields.dateOfBirth")}</span>
                  <input
                    className={inputClass()}
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(event) => updateField("dateOfBirth", event.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-foreground">{tTravelers("fields.nationality")}</span>
                  <input
                    className={inputClass()}
                    value={form.nationality}
                    onChange={(event) => updateField("nationality", event.target.value)}
                    placeholder={tTravelers("placeholders.nationality")}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-foreground">{tTravelers("fields.passportNumber")}</span>
                  <input
                    className={inputClass()}
                    value={form.passportNumber}
                    onChange={(event) => updateField("passportNumber", event.target.value)}
                    placeholder={tTravelers("placeholders.passportNumber")}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-foreground">{tTravelers("fields.passportExpiryDate")}</span>
                  <input
                    className={inputClass()}
                    type="date"
                    value={form.passportExpiryDate}
                    onChange={(event) => updateField("passportExpiryDate", event.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-foreground">{tTravelers("fields.phone")}</span>
                  <input
                    className={inputClass()}
                    value={form.phone}
                    onChange={(event) => updateField("phone", event.target.value)}
                    placeholder={tTravelers("placeholders.phone")}
                  />
                </label>
                <label className="grid gap-1 text-sm sm:col-span-2">
                  <span className="font-medium text-foreground">{tTravelers("fields.email")}</span>
                  <input
                    className={inputClass()}
                    type="email"
                    value={form.email}
                    onChange={(event) => updateField("email", event.target.value)}
                    placeholder={tTravelers("placeholders.email")}
                  />
                </label>
              </div>

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
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
