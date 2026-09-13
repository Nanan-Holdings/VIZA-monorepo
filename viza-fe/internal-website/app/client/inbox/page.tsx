import { getLocale } from "next-intl/server";
import { listClientInbox, type InboxRow } from "@/app/actions/inbox";
import { sanitiseInboundHtml, escapeText } from "@/lib/inbox/sanitize-html";

export const dynamic = "force-dynamic";

type InboxCopy = {
  bodyStored: (size: string) => string;
  noBody: string;
  from: string;
  downloadEml: string;
};

const COPY: Record<"en" | "zh", InboxCopy & { title: string; description: string; noMail: string }> = {
  en: {
    title: "Inbox",
    description:
      "Mail received at your VIZA inbox alias on your behalf. Remote images are blocked by default — download the raw message if you want to inspect anything we hide.",
    noMail: "No mail yet — your alias is configured but no messages have arrived.",
    bodyStored: (size) => `Body stored as attachment (${size} KB). Download via the link above.`,
    noBody: "No body content.",
    from: "from",
    downloadEml: "Download .eml",
  },
  zh: {
    title: "收件箱",
    description:
      "这里显示发送到你的 VIZA 收件别名的邮件。远程图片默认会被拦截；如果需要查看被隐藏的内容，可以下载原始邮件。",
    noMail: "暂时没有邮件——你的收件别名已经配置，但还没有收到消息。",
    bodyStored: (size) => `正文已作为附件保存（${size} KB），请通过上方链接下载。`,
    noBody: "没有正文内容。",
    from: "发件人",
    downloadEml: "下载 .eml",
  },
};

function getCopy(locale: string) {
  return locale.toLowerCase().startsWith("zh") ? COPY.zh : COPY.en;
}

function MessageBody({ row, copy }: { row: InboxRow; copy: InboxCopy }) {
  if (row.html) {
    const safe = sanitiseInboundHtml(row.html);
    return (
      <div
        className="prose prose-sm max-w-none text-[#232323]"
        dangerouslySetInnerHTML={{ __html: safe }}
      />
    );
  }
  if (row.text) {
    return (
      <pre className="whitespace-pre-wrap break-words text-sm text-[#232323] font-mono">
        {row.text}
      </pre>
    );
  }
  if (row.r2_key) {
    return (
      <p className="text-sm text-[#6b6b6b]">
        {copy.bodyStored((row.raw_size / 1024).toFixed(1))}
      </p>
    );
  }
  return <p className="text-sm text-[#9ca3af]">{copy.noBody}</p>;
}

function MessageRow({ row, locale, copy }: { row: InboxRow; locale: string; copy: InboxCopy }) {
  const downloadHref = row.r2_key ? `/api/inbox/${row.id}/download` : null;
  return (
    <article
      key={row.id}
      className="bg-white rounded-lg border border-[#efefef] shadow-sm overflow-hidden"
    >
      <header className="flex items-start justify-between gap-4 px-4 py-3 border-b bg-[#fafafa]">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[#6b6b6b]">
            {new Date(row.received_at).toLocaleString(locale)} · {copy.from}{" "}
            <span className="font-mono">{escapeText(row.from_addr)}</span>
          </p>
          <h3 className="text-base font-semibold text-[#232323] truncate">
            {escapeText(row.subject ?? "(no subject)")}
          </h3>
        </div>
        {downloadHref ? (
          <a
            href={downloadHref}
            className="text-xs text-brand-500 hover:underline whitespace-nowrap"
          >
            {copy.downloadEml}
          </a>
        ) : null}
      </header>
      <div className="px-4 py-4">
        <MessageBody row={row} copy={copy} />
      </div>
    </article>
  );
}

export default async function ClientInboxPage() {
  const [locale, rows] = await Promise.all([getLocale(), listClientInbox(100)]);
  const copy = getCopy(locale);
  return (
    <div className="w-full p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-[#232323]">{copy.title}</h1>
        <p className="text-sm text-[#6b6b6b] mt-1">
          {copy.description}
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-[#9ca3af]">
          {copy.noMail}
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <MessageRow key={row.id} row={row} locale={locale} copy={copy} />
          ))}
        </div>
      )}
    </div>
  );
}
