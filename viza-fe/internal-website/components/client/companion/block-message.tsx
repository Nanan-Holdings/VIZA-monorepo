"use client";

import { ArrowRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// Block Field Types (matching backend ApplicationBlockPayload)
// =============================================================================

export interface BlockField {
  name: string;
  label: string;
  type: "text" | "date" | "select" | "file";
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

export interface ApplicationBlockPayload {
  blockType:
    | "trip_basics"
    | "traveller_identity"
    | "visa_route_specific"
    | "application_redirect"
    | string;
  title: string;
  description?: string;
  fields?: BlockField[];
  saveTarget:
    | "applicant_profile"
    | "application"
    | "visa_application_answers"
    | "application_redirect"
    | string;
  applicationId?: string;
  redirectUrl?: string;
  ctaLabel?: string;
  country?: string;
  visaType?: string | null;
}

interface BlockMessageProps {
  payload: ApplicationBlockPayload;
  prefillData?: Record<string, string>;
  alreadySaved?: boolean;
}

export function BlockMessage({
  payload,
}: BlockMessageProps) {
  const redirectUrl = payload.redirectUrl ?? "/client/application";
  const ctaLabel = payload.ctaLabel ?? "Open application form";

  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-500/10">
        <FileText className="h-4 w-4 text-brand-500" />
      </div>

      <div className="max-w-sm flex-1 overflow-hidden rounded-xl rounded-tl-md border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-sm font-medium text-gray-800">{payload.title}</p>
          {payload.description ? (
            <p className="mt-0.5 text-xs text-gray-500">{payload.description}</p>
          ) : null}
        </div>

        <div className="px-4 py-3">
          <a
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              "bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700"
            )}
            href={redirectUrl}
          >
            {ctaLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
