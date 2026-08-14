"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { FileText } from "@phosphor-icons/react";
import { requestInvoice, type InvoiceRequestState } from "./actions";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { BrandField, BrandInput } from "@/components/client/brand-field";
import { ClientErrorAlert } from "@/components/client/client-error-alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getBillingCopy } from "./copy";

interface InvoiceRequestFormProps {
  paymentRecordId: string;
  defaultEmail: string | null;
}

const INITIAL_STATE: InvoiceRequestState = {
  status: "idle",
  message: "",
};

export function InvoiceRequestForm({
  paymentRecordId,
  defaultEmail,
}: InvoiceRequestFormProps) {
  const router = useRouter();
  const locale = useLocale();
  const copy = getBillingCopy(locale);
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(requestInvoice, INITIAL_STATE);

  useEffect(() => {
    if (state.status !== "success") return;

    router.refresh();
    const timeout = window.setTimeout(() => setOpen(false), 900);
    return () => window.clearTimeout(timeout);
  }, [router, state.status]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 rounded-full">
          <FileText className="h-4 w-4" />
          {copy.actions.requestInvoice}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{copy.actions.requestInvoiceTitle}</DialogTitle>
          <DialogDescription>
            {copy.actions.requestInvoiceDescription}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="paymentRecordId" value={paymentRecordId} />
          <input type="hidden" name="locale" value={locale} />

          <BrandField label={copy.actions.invoiceName} htmlFor={`invoice-name-${paymentRecordId}`} required>
            <BrandInput
              id={`invoice-name-${paymentRecordId}`}
              name="invoiceName"
              placeholder={copy.actions.invoiceNamePlaceholder}
              autoComplete="organization"
              required
            />
          </BrandField>

          <BrandField label={copy.actions.billingEmail} htmlFor={`billing-email-${paymentRecordId}`} required>
            <BrandInput
              id={`billing-email-${paymentRecordId}`}
              name="billingEmail"
              type="email"
              defaultValue={defaultEmail ?? ""}
              placeholder={copy.actions.billingEmailPlaceholder}
              autoComplete="email"
              required
            />
          </BrandField>

          <BrandField
            label={copy.actions.taxIdentifier}
            htmlFor={`tax-identifier-${paymentRecordId}`}
            hint={copy.actions.taxIdentifierHint}
          >
            <BrandInput
              id={`tax-identifier-${paymentRecordId}`}
              name="taxIdentifier"
              placeholder={copy.actions.taxIdentifierPlaceholder}
              autoComplete="off"
            />
          </BrandField>

          <BrandField label={copy.actions.notes} htmlFor={`invoice-notes-${paymentRecordId}`}>
            <Textarea
              id={`invoice-notes-${paymentRecordId}`}
              name="notes"
              placeholder={copy.actions.notesPlaceholder}
              className="min-h-24 rounded-lg border-[#e8e8e8] text-base focus-visible:ring-brand-500"
            />
          </BrandField>

          {state.message ? (
            state.status === "error" ? (
              <ClientErrorAlert message={state.message} />
            ) : (
              <p className="text-sm text-emerald-700" role="status" aria-live="polite">
                {state.message}
              </p>
            )
          ) : null}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => setOpen(false)}>
              {copy.actions.cancel}
            </Button>
            <BrandActionButton type="submit" loading={isPending} loadingText={copy.actions.submittingRequest}>
              {copy.actions.submitRequest}
            </BrandActionButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
