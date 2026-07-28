"use client";

import * as React from "react";
import { CheckCircle2, XCircle, ShieldCheck, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Read-only summary of the AU Subclass 600 character + health declarations
 * the applicant will sign. Shows each item with the Yes/No they recorded
 * during the wizard so they can verify before stamping their signature.
 *
 * The declaration list mirrors `wizards/au/config.ts` HEALTH_ITEMS +
 * CHARACTER_ITEMS. Translation keys live under `simplifiedForm.au.*` —
 * the parent passes a `t()` function so this component stays presentation-
 * only.
 */

export interface DeclarationItem {
  /** Form field key (e.g. `decl_health_lived_outside_passport_country`). */
  key: string;
  /** Localised question text. */
  question: string;
  /** Recorded answer — `"yes"` / `"no"` / empty. */
  answer: string;
}

export interface DeclarationPreviewProps {
  health: DeclarationItem[];
  character: DeclarationItem[];
  /** Optional final declarations checklist (information_correct, etc.). */
  final?: DeclarationItem[];
  className?: string;
  /** Section heading text. Defaults to English; pass localized in parent. */
  healthHeading?: string;
  characterHeading?: string;
  finalHeading?: string;
  yesLabel?: string;
  noLabel?: string;
  unanswered?: string;
}

function AnswerBadge({
  value,
  yes,
  no,
  unanswered,
}: {
  value: string;
  yes: string;
  no: string;
  unanswered: string;
}) {
  if (value === "yes") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-[12px] font-medium text-brand-500">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {yes}
      </span>
    );
  }
  if (value === "no") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[12px] font-medium text-foreground">
        <XCircle className="h-3.5 w-3.5" />
        {no}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-input px-2.5 py-0.5 text-[12px] text-muted-foreground">
      {unanswered}
    </span>
  );
}

function Section({
  icon,
  heading,
  items,
  yes,
  no,
  unanswered,
}: {
  icon: React.ReactNode;
  heading: string;
  items: DeclarationItem[];
  yes: string;
  no: string;
  unanswered: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
        <span className="text-brand-500">{icon}</span>
        {heading}
      </h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-start justify-between gap-3 rounded-lg border border-input bg-white px-3 py-2.5"
          >
            <span className="text-[13px] leading-relaxed text-foreground">{item.question}</span>
            <AnswerBadge value={item.answer} yes={yes} no={no} unanswered={unanswered} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DeclarationPreview({
  health,
  character,
  final,
  className,
  healthHeading = "Health declarations",
  characterHeading = "Character declarations",
  finalHeading = "Final acknowledgements",
  yesLabel = "Yes",
  noLabel = "No",
  unanswered = "Not answered",
}: DeclarationPreviewProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <Section
        icon={<Stethoscope className="h-4 w-4" />}
        heading={healthHeading}
        items={health}
        yes={yesLabel}
        no={noLabel}
        unanswered={unanswered}
      />
      <Section
        icon={<ShieldCheck className="h-4 w-4" />}
        heading={characterHeading}
        items={character}
        yes={yesLabel}
        no={noLabel}
        unanswered={unanswered}
      />
      {final && (
        <Section
          icon={<CheckCircle2 className="h-4 w-4" />}
          heading={finalHeading}
          items={final}
          yes={yesLabel}
          no={noLabel}
          unanswered={unanswered}
        />
      )}
    </div>
  );
}
