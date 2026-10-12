import { getLocale } from "next-intl/server";
import {
  listAdminSupportInbox,
  listAdminTicketMessages,
  listInternalNotes,
  listMacros,
  type TicketTab,
} from "@/app/actions/admin-cs";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { AdminSupportInboxClient } from "./support-inbox-client";
import { getCurrentUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const COPY = {
  en: {
    title: "Support inbox",
    subtitle: "Review customer email questions and send staff replies.",
    kpis: "KPIs",
    loadError: "Unable to load support inbox",
  },
  zh: {
    title: "客服收件箱",
    subtitle: "查看客户通过邮件/帮助中心提交的问题，并在右侧窗口回复。",
    kpis: "指标",
    loadError: "无法加载客服收件箱",
  },
} as const;

function normalizeTab(value?: string): TicketTab {
  if (value === "p2" || value === "mine" || value === "unassigned" || value === "breaching") return value;
  return "open";
}

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; ticket?: string }>;
}) {
  const locale = normalizeInterfaceLocale(await getLocale());
  const copy = COPY[locale];
  const resolvedSearchParams = await searchParams;
  const tab = normalizeTab(resolvedSearchParams.tab);
  const { rows, error } = await listAdminSupportInbox(tab);
  const selectedTicket = rows?.find((row) => row.id === resolvedSearchParams.ticket) ?? rows?.[0] ?? null;
  const [messagesResult, notesResult, macrosResult, currentUser] = await Promise.all([
    selectedTicket ? listAdminTicketMessages(selectedTicket.id) : Promise.resolve({ rows: [] }),
    selectedTicket ? listInternalNotes(selectedTicket.id) : Promise.resolve({ rows: [] }),
    listMacros("ANY"),
    getCurrentUser(),
  ]);

  return (
    <section className="mx-auto flex max-w-[1440px] flex-col gap-5 p-4 lg:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#232323]">{copy.title}</h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">{copy.subtitle}</p>
        </div>
        <a href="/admin/cs/kpis" className="text-sm font-semibold text-brand-500 hover:underline">
          {copy.kpis}
        </a>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="font-semibold">{copy.loadError}</span>: {error}
        </div>
      ) : (
        <AdminSupportInboxClient
          initialTab={tab}
          initialRows={rows ?? []}
          initialMessages={messagesResult.rows ?? []}
          initialSelectedId={selectedTicket?.id ?? ""}
          initialNotes={notesResult.rows ?? []}
          initialMacros={macrosResult.rows ?? []}
          currentUserId={currentUser?.id ?? ""}
        />
      )}
    </section>
  );
}
