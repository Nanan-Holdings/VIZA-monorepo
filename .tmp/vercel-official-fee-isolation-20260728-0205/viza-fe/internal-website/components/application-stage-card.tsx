"use client";

import Link from "next/link";
import { ArrowRight, Clock, CreditCard, Download, FileCheck2, Info, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ApplicationStageCardProps {
  applicationId: string;
  status: string;
  country: string;
  visaType: string;
  payUrl?: string | null;
  documentUrl?: string | null;
  etaIso?: string | null;
}

interface StageMeta {
  title: string;
  body: string;
  cta?: { label: string; href: string };
  icon: React.ReactNode;
  tone: "default" | "warning" | "success";
}

function describeStage(props: ApplicationStageCardProps): StageMeta {
  const base = `${props.country} · ${props.visaType.replace(/_/g, " ")}`;
  switch (props.status) {
    case "draft":
      return {
        title: `Draft — ${base}`,
        body: "Finish answering the application questions to unlock payment.",
        cta: { label: "Continue answers", href: `/application/${props.applicationId}/answer` },
        icon: <Info className="h-5 w-5 text-brand-500" />,
        tone: "default",
      };
    case "payment_pending":
      return {
        title: `Payment pending — ${base}`,
        body: "Your answers are locked in. Pay the government + service fee to start submission.",
        cta: props.payUrl ? { label: "Pay now", href: props.payUrl } : undefined,
        icon: <CreditCard className="h-5 w-5 text-brand-500" />,
        tone: "warning",
      };
    case "submitted_to_government":
      return {
        title: `Submitted — ${base}`,
        body: "We've handed your application to the government and are watching for the decision.",
        icon: <FileCheck2 className="h-5 w-5 text-brand-500" />,
        tone: "default",
      };
    case "biometrics_pending":
      return {
        title: `Biometrics needed — ${base}`,
        body: "Book your in-person biometrics appointment to keep your application moving.",
        cta: { label: "View instructions", href: `/application/${props.applicationId}` },
        icon: <Clock className="h-5 w-5 text-brand-500" />,
        tone: "warning",
      };
    case "delivered":
      return {
        title: `Approved — ${base}`,
        body: "Your visa document is ready to download.",
        cta: props.documentUrl ? { label: "Download visa", href: props.documentUrl } : undefined,
        icon: <Download className="h-5 w-5 text-brand-500" />,
        tone: "success",
      };
    case "staff_action_required":
      return {
        title: `Staff review — ${base}`,
        body: "Our team flagged something on your application; we'll reach out by email shortly.",
        icon: <ShieldAlert className="h-5 w-5 text-destructive" />,
        tone: "warning",
      };
    default:
      return {
        title: `${props.status} — ${base}`,
        body: "Your application is in progress.",
        icon: <Info className="h-5 w-5 text-brand-500" />,
        tone: "default",
      };
  }
}

export function ApplicationStageCard(props: ApplicationStageCardProps) {
  const meta = describeStage(props);
  return (
    <Card className="border-input shadow-sm">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          {meta.icon}
          <h2 className="text-base font-semibold text-foreground">{meta.title}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{meta.body}</p>
        {props.etaIso ? (
          <p className="text-xs text-muted-foreground">
            ETA: {new Date(props.etaIso).toLocaleDateString()}
          </p>
        ) : null}
        {meta.cta ? (
          <div className="pt-1">
            <Link href={meta.cta.href}>
              <Button type="button" className="bg-brand-500 hover:bg-brand-400">
                {meta.cta.label} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
