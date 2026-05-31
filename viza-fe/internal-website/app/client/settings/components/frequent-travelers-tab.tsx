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
  type FrequentTravelerInput,
  type FrequentTravelerSummary,
} from "../actions";

type Notice = {
  tone: "success" | "error";
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

function toForm(traveler: FrequentTravelerSummary): FrequentTravelerInput {
  return {
    fullName: traveler.fullName,
    dateOfBirth: traveler.dateOfBirth ?? "",
    nationality: traveler.nationality ?? "",
    passportNumber: traveler.passportNumber ?? "",
    passportExpiryDate: traveler.passportExpiryDate ?? "",
    email: traveler.email ?? "",
    phone: traveler.phone ?? "",
  };
}

function obfuscatePassport(value: string | null) {
  if (!value) return null;
  if (value.length <= 4) return value;
  return `••${value.slice(-4)}`;
}

function Field({
  label,
  children,
  required = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-foreground">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function inputClass() {
  return "h-12 rounded-lg border bg-white px-4 text-base outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
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
        setNotice({ tone: "error", message: t("loadError") });
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

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label={t("fields.fullName")} required>
              <input
                className={inputClass()}
                value={form.fullName}
                onChange={(event) => updateField("fullName", event.target.value)}
                placeholder={t("placeholders.fullName")}
              />
            </Field>
            <Field label={t("fields.dateOfBirth")}>
              <input
                className={inputClass()}
                type="date"
                value={form.dateOfBirth}
                onChange={(event) => updateField("dateOfBirth", event.target.value)}
              />
            </Field>
            <Field label={t("fields.nationality")}>
              <input
                className={inputClass()}
                value={form.nationality}
                onChange={(event) => updateField("nationality", event.target.value)}
                placeholder={t("placeholders.nationality")}
              />
            </Field>
            <Field label={t("fields.passportNumber")}>
              <input
                className={inputClass()}
                value={form.passportNumber}
                onChange={(event) => updateField("passportNumber", event.target.value)}
                placeholder={t("placeholders.passportNumber")}
              />
            </Field>
            <Field label={t("fields.passportExpiryDate")}>
              <input
                className={inputClass()}
                type="date"
                value={form.passportExpiryDate}
                onChange={(event) => updateField("passportExpiryDate", event.target.value)}
              />
            </Field>
            <Field label={t("fields.phone")}>
              <input
                className={inputClass()}
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                placeholder={t("placeholders.phone")}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label={t("fields.email")}>
                <input
                  className={inputClass()}
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  placeholder={t("placeholders.email")}
                />
              </Field>
            </div>
          </div>

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
            <Button type="button" className="h-11 rounded-full" onClick={openCreateForm}>
              <Plus className="h-4 w-4" />
              {t("addFirst")}
            </Button>
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
