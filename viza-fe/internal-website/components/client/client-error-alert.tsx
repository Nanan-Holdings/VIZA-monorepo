import * as React from "react";

import {
  Alert,
  AlertActions,
  AlertDescription,
  AlertIcon,
  AlertTitle,
} from "@/components/ui/alert";

export interface ClientErrorAlertProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof Alert>,
    "children" | "title" | "variant"
  > {
  message: React.ReactNode;
  action?: React.ReactNode;
  title?: React.ReactNode;
}

/**
 * Canonical applicant-facing error notice. This deliberately composes the
 * destructive Alert demonstrated at /ui-components so client routes do not
 * invent their own red boxes, icons, spacing, or accessibility behavior.
 */
export function ClientErrorAlert({
  action,
  message,
  title,
  ...props
}: ClientErrorAlertProps) {
  return (
    <Alert variant="destructive" data-client-error-alert="" {...props}>
      <AlertIcon variant="destructive" />
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription>
        {typeof message === "string" ? <p>{message}</p> : message}
        {action ? <AlertActions>{action}</AlertActions> : null}
      </AlertDescription>
    </Alert>
  );
}
