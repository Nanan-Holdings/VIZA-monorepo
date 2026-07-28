"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeInterfaceLocale, type InterfaceLocale } from "@/lib/i18n/locale";
import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";

interface PortalShellPageProps {
  title?: string;
  description?: string;
}

export function PortalShellPage({
  title = "Coming Soon",
  description = "This page has been intentionally reduced to a lightweight shell.",
}: PortalShellPageProps) {
  const locale = normalizeInterfaceLocale(useLocale());
  const pathname = usePathname();
  const content = getShellContent(pathname, { title, description }, locale);

  return (
    <div className="w-full p-6 md:p-8">
      <Card className="max-w-3xl border border-[#efefef] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-[#232323]">{content.title}</CardTitle>
          <CardDescription className="text-sm text-[#6b6b6b]">{content.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-[#d9d9d9] bg-[#fafafa] p-4 text-sm text-[#5f5f5f]">
            {locale === "zh"
              ? "此路由作为模块化外壳保持可用，可继续承载 VIZA 系统功能。"
              : "This route stays active as a modular shell and is ready for VIZA system features."}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getShellContent(
  pathname: string,
  fallback: { title: string; description: string },
  locale: InterfaceLocale,
): { title: string; description: string } {
  const rules = getRules(locale);

  const normalized = normalizePath(pathname);

  for (const rule of rules) {
    if (normalized.includes(rule.key)) {
      return { title: rule.title, description: rule.description };
    }
  }

  if (fallback.title !== "Coming Soon" || fallback.description !== "This page has been intentionally reduced to a lightweight shell.") {
    return fallback;
  }

  return locale === "zh"
    ? { title: "即将开放", description: "此页面已保留为轻量模块外壳。" }
    : fallback;
}

function getRules(locale: InterfaceLocale): Array<{ key: string; title: string; description: string }> {
  if (locale === "zh") {
    return [
      {
        key: "/manage",
        title: "运营控制台",
        description: "用于日常 VIZA 运营和服务执行的集中视图。",
      },
      {
        key: "/orders/[id]",
        title: "订单详情控制台",
        description: "用于单个订单执行、核验和时间线跟踪的模块外壳。",
      },
      {
        key: "/orders",
        title: "订单管理中心",
        description: "用于订单接收、队列优先级和履约协调的模块外壳。",
      },
      {
        key: "/products",
        title: "产品目录控制台",
        description: "用于产品治理、库存逻辑和目录运营的模块外壳。",
      },
      {
        key: "/consultations/reports",
        title: "洞察与报告",
        description: "用于分析面板、绩效报告和 KPI 汇总的模块外壳。",
      },
      {
        key: "/consultations",
        title: "咨询排期与会话",
        description: "用于日历编排、预约和服务会话管理的模块外壳。",
      },
      {
        key: "/admin",
        title: "管理控制台",
        description: "用于平台级管理和监督的治理外壳。",
      },
    ];
  }

  return [
    {
      key: "/manage",
      title: "Operations Control Tower",
      description: "Central view for day-to-day VIZA operations and service execution.",
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
      key: "/admin",
      title: "Admin Control Tower",
      description: "Governance shell for platform-level administration and oversight.",
    },
  ];
}

function normalizePath(pathname: string): string {
  return pathname
    .replace(/\/[0-9a-fA-F-]{8,}/g, "/[id]")
    .replace(/\/[0-9]+/g, "/[id]");
}
