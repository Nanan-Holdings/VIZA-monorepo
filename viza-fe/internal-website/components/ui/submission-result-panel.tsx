import type { ReactNode } from "react";
import {
  CheckCircle,
  CircleNotch,
  Warning,
  XCircle,
} from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type SubmissionPanelState = "success" | "pending" | "action-required" | "failure";

export interface SubmissionStatePanelProps {
  state: SubmissionPanelState;
  title: string;
  summary?: string | null;
  children?: ReactNode;
  actions?: ReactNode;
}

const stateIcon = {
  success: <CheckCircle className="h-5 w-5 text-brand-500" weight="fill" aria-hidden="true" />,
  pending: <CircleNotch className="h-5 w-5 animate-spin text-brand-500" aria-hidden="true" />,
  "action-required": <Warning className="h-5 w-5 text-amber-600" weight="fill" aria-hidden="true" />,
  failure: <XCircle className="h-5 w-5 text-destructive" weight="fill" aria-hidden="true" />,
} satisfies Record<SubmissionPanelState, ReactNode>;

/**
 * Canonical, presentation-only frame for all in-flow application submission
 * states. It deliberately has no country or submission logic: adapters supply
 * localized facts, official evidence, and `ActionButton` slots.
 */
export function SubmissionStatePanel({
  state,
  title,
  summary,
  children,
  actions,
}: SubmissionStatePanelProps) {
  return (
    <Card className="rounded-xl border-input" data-submission-state={state}>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-foreground">
          {stateIcon[state]}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary ? <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p> : null}
        {children}
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </CardContent>
    </Card>
  );
}

export interface TerminalSuccessPanelProps {
  title: string;
  summary?: string | null;
  reference?: string | null;
  referenceLabel?: string;
  artifacts?: ReactNode;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  nextStep?: ReactNode;
}

/**
 * Canonical confirmed-success composition. It is a focused convenience layer
 * over SubmissionStatePanel so every country receives the same title,
 * reference, artifact, and action hierarchy.
 */
export function TerminalSuccessPanel({
  title,
  summary,
  reference,
  referenceLabel = "Reference",
  artifacts,
  primaryAction,
  secondaryActions,
  nextStep,
}: TerminalSuccessPanelProps) {
  return (
    <SubmissionStatePanel
      state="success"
      title={title}
      summary={summary}
      actions={primaryAction || secondaryActions ? <>{primaryAction}{secondaryActions}</> : undefined}
    >
      {reference ? (
        <div className="rounded-md border border-input bg-background px-3 py-2">
          <p className="text-xs text-muted-foreground">{referenceLabel}</p>
          <p className="mt-0.5 font-mono text-base font-medium text-foreground">{reference}</p>
        </div>
      ) : null}
      {artifacts ? <div className="space-y-3">{artifacts}</div> : null}
      {nextStep ? <div className="text-sm text-muted-foreground">{nextStep}</div> : null}
    </SubmissionStatePanel>
  );
}
