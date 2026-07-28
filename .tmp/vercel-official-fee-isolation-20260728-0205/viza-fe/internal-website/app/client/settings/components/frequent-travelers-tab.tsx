"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { motion } from "motion/react";
import {
  AlertCircle,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
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
import { Button } from "@/components/ui/button";
import {
  createFrequentTraveler,
  deleteFrequentTraveler,
  getFrequentTravelers,
  updateFrequentTraveler,
  type FrequentTravelerSummary,
} from "@/app/actions/client-settings";
import { FrequentTravelerProfileFields } from "@/components/application-steps/frequent-traveler-profile-fields";
import type { FrequentTravelerInput } from "@/lib/frequent-traveler-profile";

type Notice = {
  tone: "success" | "error";
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

function toForm(traveler: FrequentTravelerSummary): FrequentTravelerInput {
  const legacyName = splitLegacyTravelerName(traveler.fullName);
  return {
    fullName: traveler.fullName,
    fullNameZh: traveler.fullNameZh ?? "",
    fullNameEn: traveler.fullNameEn ?? traveler.fullName,
    surname: traveler.surname ?? legacyName.surname,
    surnameZh: traveler.surnameZh ?? "",
    surnameEn: traveler.surnameEn ?? legacyName.surname,
    givenNames: traveler.givenNames ?? legacyName.givenNames,
    givenNamesZh: traveler.givenNamesZh ?? "",
    givenNamesEn: traveler.givenNamesEn ?? legacyName.givenNames,
    dateOfBirth: traveler.dateOfBirth ?? "",
    placeOfBirth: traveler.placeOfBirth ?? "",
    placeOfBirthZh: traveler.placeOfBirthZh ?? "",
    placeOfBirthEn: traveler.placeOfBirthEn ?? "",
    birthCountry: traveler.birthCountry ?? "",
    birthProvinceOrState: traveler.birthProvinceOrState ?? "",
    birthProvinceOrStateZh: traveler.birthProvinceOrStateZh ?? "",
    birthProvinceOrStateEn: traveler.birthProvinceOrStateEn ?? "",
    birthCity: traveler.birthCity ?? "",
    birthCityZh: traveler.birthCityZh ?? "",
    birthCityEn: traveler.birthCityEn ?? "",
    gender: traveler.gender ?? "",
    nationality: traveler.nationality ?? "",
    occupation: traveler.occupation ?? "",
    occupationZh: traveler.occupationZh ?? "",
    occupationEn: traveler.occupationEn ?? "",
    address: traveler.address ?? "",
    addressZh: traveler.addressZh ?? "",
    addressEn: traveler.addressEn ?? "",
    passportNumber: traveler.passportNumber ?? "",
    passportIssueDate: traveler.passportIssueDate ?? "",
    passportExpiryDate: traveler.passportExpiryDate ?? "",
    passportIssuingCountry: traveler.passportIssuingCountry ?? "",
    passportIssuingAuthority: traveler.passportIssuingAuthority ?? "",
    email: traveler.email ?? "",
    phone: traveler.phone ?? "",
    wechat: traveler.wechat ?? "",
  };
}

function splitLegacyTravelerName(fullName: string) {
  const compact = fullName.replace(/\s+/g, "").trim();
  if (/^[\u3400-\u9fff]{2,}$/.test(compact)) {
    return { surname: compact.slice(0, 1), givenNames: compact.slice(1) };
  }

  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { surname: "", givenNames: "" };
  if (parts.length === 1) return { surname: parts[0] ?? "", givenNames: "" };
  return { surname: parts[0] ?? "", givenNames: parts.slice(1).join(" ") };
}

function obfuscatePassport(value: string | null) {
  if (!value) return null;
  if (value.length <= 4) return value;
  return `••${value.slice(-4)}`;
}

export function FrequentTravelersTab() {
  const t = useTranslations("settings.travelers");
  const [travelers, setTravelers] = useState<FrequentTravelerSummary[]>([]);
  const [form, setForm] = useState<FrequentTravelerInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isPending, startTransition] = useTransition();

  const editingTraveler = useMemo(
    () => travelers.find((traveler) => traveler.id === editingId) ?? null,
    [editingId, travelers]
  );

  useEffect(() => {
    let mounted = true;

    async function loadTravelers() {
      setIsLoading(true);
      const result = await getFrequentTravelers();

      if (!mounted) return;

      if (result.success) {
        setTravelers(result.travelers);
      } else {
        setTravelers([]);
      }

      setIsLoading(false);
    }

    void loadTravelers();

    return () => {
      mounted = false;
    };
  }, [t]);

  function updateField(field: keyof FrequentTravelerInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setNotice(null);
  }

  function openCreateForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
    setNotice(null);
  }

  function openEditForm(traveler: FrequentTravelerSummary) {
    setEditingId(traveler.id);
    setForm(toForm(traveler));
    setFormOpen(true);
    setNotice(null);
  }

  function closeForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(false);
    setNotice(null);
  }

  function handleSave() {
    startTransition(async () => {
      const result = editingId
        ? await updateFrequentTraveler(editingId, form)
        : await createFrequentTraveler(form);

      if (!result.success) {
        setNotice({ tone: "error", message: t("saveError") });
        return;
      }

      setTravelers((current) => {
        const next = current.filter((traveler) => traveler.id !== result.traveler.id);
        return [result.traveler, ...next];
      });
      setNotice({
        tone: "success",
        message: editingId ? t("updated") : t("created"),
      });
      setEditingId(null);
      setForm(EMPTY_FORM);
      setFormOpen(false);
    });
  }

  function handleDelete(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const result = await deleteFrequentTraveler(id);
      setPendingId(null);

      if (!result.success) {
        setNotice({ tone: "error", message: t("deleteError") });
        return;
      }

      setTravelers((current) => current.filter((traveler) => traveler.id !== id));
      if (editingId === id) closeForm();
      setNotice({ tone: "success", message: t("deleted") });
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
            <UsersRound className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
              {t("title")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {t("description")}
            </p>
          </div>
        </div>
        <Button type="button" className="h-11 rounded-full" onClick={openCreateForm}>
          <Plus className="h-4 w-4" />
          {t("add")}
        </Button>
      </div>

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

      {formOpen ? (
        <motion.div
          className="rounded-xl border bg-white p-5 shadow-sm sm:p-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {editingTraveler ? t("editTitle") : t("addTitle")}
              </h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("formHint")}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={closeForm}
              aria-label={t("cancel")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <FrequentTravelerProfileFields
            value={form}
            onFieldChange={updateField}
            className="mt-5"
          />

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="h-11 rounded-full"
              onClick={handleSave}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isPending ? t("saving") : t("save")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full"
              onClick={closeForm}
              disabled={isPending}
            >
              {t("cancel")}
            </Button>
          </div>
        </motion.div>
      ) : null}

      <div className="rounded-xl border bg-white shadow-sm">
        {isLoading ? (
          <div className="flex min-h-44 flex-col items-center justify-center gap-3 p-6">
            <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          </div>
        ) : travelers.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center gap-3 p-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500">
              <UserRound className="h-6 w-6" />
            </span>
            <div>
              <p className="text-lg font-semibold text-foreground">{t("emptyTitle")}</p>
              <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                {t("emptyDescription")}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {travelers.map((traveler) => (
              <article
                key={traveler.id}
                className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5"
              >
                <div className="flex gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                    {traveler.fullName.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {traveler.fullName}
                    </h3>
                    <dl className="mt-2 grid gap-x-5 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2">
                      <div>
                        <dt className="sr-only">{t("fields.nationality")}</dt>
                        <dd>{traveler.nationality || t("notSet")}</dd>
                      </div>
                      <div>
                        <dt className="sr-only">{t("fields.passportNumber")}</dt>
                        <dd>{obfuscatePassport(traveler.passportNumber) || t("notSet")}</dd>
                      </div>
                      <div>
                        <dt className="sr-only">{t("fields.dateOfBirth")}</dt>
                        <dd>{traveler.dateOfBirth || t("notSet")}</dd>
                      </div>
                      <div>
                        <dt className="sr-only">{t("fields.passportExpiryDate")}</dt>
                        <dd>{traveler.passportExpiryDate || t("notSet")}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-full"
                    onClick={() => openEditForm(traveler)}
                  >
                    <Pencil className="h-4 w-4" />
                    {t("edit")}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        disabled={pendingId === traveler.id}
                      >
                        {pendingId === traveler.id ? (
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
                        <AlertDialogDescription>
                          {t("deleteDialog.description", { name: traveler.fullName })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("deleteDialog.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => handleDelete(traveler.id)}
                        >
                          {t("deleteDialog.confirm")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {!isLoading && travelers.length > 0 ? (
        <div className="flex gap-3 rounded-lg border border-brand-100 bg-brand-50 p-4 text-sm leading-6 text-brand-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{t("handoffHint")}</p>
        </div>
      ) : null}
    </div>
  );
}
