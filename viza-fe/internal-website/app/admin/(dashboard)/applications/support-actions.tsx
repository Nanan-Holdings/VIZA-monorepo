"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { useLocale } from "next-intl";
import { Check, Clipboard, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { queueStatusNotification } from "./actions";
import { ADMIN_APPLICATION_COPY, type AdminApplicationCopy } from "./copy";

function QueueButton({
  disabled,
  copy,
}: {
  disabled: boolean;
  copy: AdminApplicationCopy;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="outline"
      className="border-[#d7d7d7] text-[#45556c]"
      disabled={disabled || pending}
    >
      <Send className="h-4 w-4" />
      {pending ? copy.actions.queueing : copy.actions.queueEmail}
    </Button>
  );
}

export function SupportActions({
  applicationId,
  applicantEmail,
  summaryText,
  returnTo,
}: {
  applicationId: string;
  applicantEmail: string | null;
  summaryText: string;
  returnTo: string;
}) {
  const locale = normalizeInterfaceLocale(useLocale());
  const copy = ADMIN_APPLICATION_COPY[locale];
  const [copied, setCopied] = useState(false);
  const mailHref = useMemo(() => {
    if (!applicantEmail) return null;
    const subject = encodeURIComponent(copy.actions.emailSubject);
    const body = encodeURIComponent(summaryText);
    return `mailto:${applicantEmail}?subject=${subject}&body=${body}`;
  }, [applicantEmail, copy.actions.emailSubject, summaryText]);

  async function copySummary() {
    await navigator.clipboard.writeText(summaryText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        className="border-[#d7d7d7] text-[#45556c]"
        onClick={copySummary}
      >
        {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
        {copied ? copy.actions.copied : copy.actions.copySummary}
      </Button>

      {mailHref && (
        <Button asChild variant="outline" className="border-[#d7d7d7] text-[#45556c]">
          <a href={mailHref}>
            <Mail className="h-4 w-4" />
            {copy.actions.draftEmail}
          </a>
        </Button>
      )}

      <form action={queueStatusNotification}>
        <input type="hidden" name="applicationId" value={applicationId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <QueueButton disabled={!applicantEmail} copy={copy} />
      </form>
    </div>
  );
}
