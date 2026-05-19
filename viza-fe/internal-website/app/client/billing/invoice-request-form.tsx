"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { requestInvoice, type InvoiceRequestState } from "./actions";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { BrandField, BrandInput } from "@/components/client/brand-field";
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
          Request invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Request agency-fee invoice</DialogTitle>
          <DialogDescription>
            Tell us the invoice details for this paid VIZA agency fee. Government portal fees are not included here.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="paymentRecordId" value={paymentRecordId} />

          <BrandField label="Invoice name" htmlFor={`invoice-name-${paymentRecordId}`} required>
            <BrandInput
              id={`invoice-name-${paymentRecordId}`}
              name="invoiceName"
              placeholder="Legal name or company name"
              autoComplete="organization"
              required
            />
          </BrandField>

          <BrandField label="Billing email" htmlFor={`billing-email-${paymentRecordId}`} required>
            <BrandInput
              id={`billing-email-${paymentRecordId}`}
              name="billingEmail"
              type="email"
              defaultValue={defaultEmail ?? ""}
              placeholder="billing@example.com"
              autoComplete="email"
              required
            />
          </BrandField>

          <BrandField
            label="Tax identifier"
            htmlFor={`tax-identifier-${paymentRecordId}`}
            hint="Optional. Add a GST, VAT, UEN, or company tax reference if your organization needs one."
          >
            <BrandInput
              id={`tax-identifier-${paymentRecordId}`}
              name="taxIdentifier"
              placeholder="Optional tax reference"
              autoComplete="off"
            />
          </BrandField>

          <BrandField label="Notes" htmlFor={`invoice-notes-${paymentRecordId}`}>
            <Textarea
              id={`invoice-notes-${paymentRecordId}`}
              name="notes"
              placeholder="Optional billing instructions"
              className="min-h-24 rounded-lg border-[#e8e8e8] text-base focus-visible:ring-brand-500"
            />
          </BrandField>

          {state.message ? (
            <p
              className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-emerald-700"}
              role={state.status === "error" ? "alert" : "status"}
              aria-live="polite"
            >
              {state.message}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <BrandActionButton type="submit" loading={isPending} loadingText="Submitting request">
              Submit request
            </BrandActionButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
