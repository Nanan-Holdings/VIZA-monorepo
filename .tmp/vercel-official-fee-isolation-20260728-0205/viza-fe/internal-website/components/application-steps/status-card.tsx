"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type ApplicationStatus = "draft" | "in_progress" | "submitted" | "approved" | "rejected";

export interface StatusCardProps {
  applicationId: string;
  status: ApplicationStatus;
  message?: string;
  onComplete?: (result: { acknowledged: true }) => void;
}

export function StatusCard({ applicationId: _applicationId, status, message }: StatusCardProps) {
  const t = useTranslations("applicationSteps");

  const STATUS_CONFIG: Record<ApplicationStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
    draft: { label: t("statusCard.draft"), variant: "outline", color: "text-muted-foreground" },
    in_progress: { label: t("statusCard.inProgress"), variant: "secondary", color: "text-brand-400" },
    submitted: { label: t("statusCard.submitted"), variant: "default", color: "text-brand-500" },
    approved: { label: t("statusCard.approved"), variant: "default", color: "text-green-600" },
    rejected: { label: t("statusCard.rejected"), variant: "destructive", color: "text-red-600" },
  };

  const config = STATUS_CONFIG[status];

  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground">{t("statusCard.applicationStatus")}</span>
            <Badge variant={config.variant}>{config.label}</Badge>
          </div>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
