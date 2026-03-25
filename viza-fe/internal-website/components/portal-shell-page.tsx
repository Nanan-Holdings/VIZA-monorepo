"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePathname } from "next/navigation";

interface PortalShellPageProps {
  title?: string;
  description?: string;
}

export function PortalShellPage({
  title = "Coming Soon",
  description = "This page has been intentionally reduced to a lightweight shell.",
}: PortalShellPageProps) {
  const pathname = usePathname();
  const content = getShellContent(pathname, { title, description });

  return (
    <div className="w-full p-6 md:p-8">
      <Card className="max-w-3xl border border-[#efefef] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-[#232323]">{content.title}</CardTitle>
          <CardDescription className="text-sm text-[#6b6b6b]">{content.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-[#d9d9d9] bg-[#fafafa] p-4 text-sm text-[#5f5f5f]">
            This route stays active as a modular shell and is ready for VIZA system features.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getShellContent(
  pathname: string,
  fallback: { title: string; description: string }
): { title: string; description: string } {
  const rules: Array<{ key: string; title: string; description: string }> = [
    {
      key: "/manage",
      title: "Operations Control Tower",
      description: "Central view for day-to-day VIZA operations and service execution.",
    },
    {
      key: "/admin",
      title: "Admin Control Tower",
      description: "Governance shell for platform-level administration and oversight.",
    },
    {
      key: "/users/[id]/sessions/",
      title: "Session Workspace",
      description: "Shell for structured service sessions, notes, and workflow handoff.",
    },
    {
      key: "/users/[id]",
      title: "Customer Record Workspace",
      description: "Unified customer profile shell for history, status, and operational context.",
    },
    {
      key: "/users",
      title: "Customer Intelligence Hub",
      description: "Shell for customer roster management, segmentation, and lifecycle views.",
    },
    {
      key: "/orders/[id]",
      title: "Order Detail Console",
      description: "Shell for per-order execution flow, verification, and timeline tracking.",
    },
    {
      key: "/orders",
      title: "Order Command Center",
      description: "Shell for order intake, queue prioritization, and fulfillment coordination.",
    },
    {
      key: "/products",
      title: "Catalog Control Panel",
      description: "Shell for product governance, inventory logic, and catalog operations.",
    },
    {
      key: "/consultations/reports",
      title: "Insights & Reporting",
      description: "Shell for analytics dashboards, performance reporting, and KPI rollups.",
    },
    {
      key: "/consultations",
      title: "Scheduling & Sessions",
      description: "Shell for calendar orchestration, appointments, and service session management.",
    },
    {
      key: "/settings",
      title: "Platform Settings",
      description: "Shell for integration settings, environment controls, and system configuration.",
    },
    {
      key: "/users",
      title: "Identity & Access",
      description: "Shell for team access management, role assignments, and permissions.",
    },
    {
      key: "/labs-booking",
      title: "Field Ops Scheduling",
      description: "Shell for appointment logistics, resource assignment, and slot management.",
    },
    {
      key: "/lab-reports",
      title: "Results Pipeline",
      description: "Shell for report ingestion, review stages, and result distribution workflows.",
    },
    {
      key: "/lab-config",
      title: "Rules & Configuration",
      description: "Shell for operational rule sets, metric configuration, and validation logic.",
    },
    {
      key: "/action-plans",
      title: "Playbooks",
      description: "Shell for action templates, guided workflows, and execution playbooks.",
    },
    {
      key: "/escalations",
      title: "Priority Queue",
      description: "Shell for incident triage, high-priority cases, and response routing.",
    },
    {
      key: "/impersonate",
      title: "Support Simulation",
      description: "Shell for controlled user-context simulation and support troubleshooting.",
    },
    {
      key: "/diagnose-orders",
      title: "Diagnostics Console",
      description: "Shell for data diagnostics, anomaly checks, and corrective operations.",
    },
    {
      key: "/referrals",
      title: "Growth Referrals",
      description: "Shell for referral tracking, partner performance, and growth channels.",
    },
    {
      key: "/admin",
      title: "Advisor Workspace",
      description: "Shell for specialist-facing workflows and high-trust service interactions.",
    },
    {
      key: "/admin",
      title: "Advisor Legacy Workspace",
      description: "Compatibility shell for legacy specialist routes during transition.",
    },
  ];

  const normalized = normalizePath(pathname);

  for (const rule of rules) {
    if (normalized.includes(rule.key)) {
      return { title: rule.title, description: rule.description };
    }
  }

  return fallback;
}

function normalizePath(pathname: string): string {
  return pathname
    .replace(/\/[0-9a-fA-F-]{8,}/g, "/[id]")
    .replace(/\/[0-9]+/g, "/[id]");
}
