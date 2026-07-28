import { listClientInbox, type InboxRow } from "@/app/actions/inbox";
import { sanitiseInboundHtml, escapeText } from "@/lib/inbox/sanitize-html";

export const dynamic = "force-dynamic";

function MessageBody({ row }: { row: InboxRow }) {
  if (row.html) {
    const safe = sanitiseInboundHtml(row.html);
    return (
      <div
        className="prose prose-sm max-w-none text-[#232323]"
        // eslint-disable-next-line react/no-danger
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
        Body stored as attachment ({(row.raw_size / 1024).toFixed(1)} KB).
        Download via the link above.
      </p>
    );
  }
  return <p className="text-sm text-[#9ca3af]">No body content.</p>;
}

function MessageRow({ row }: { row: InboxRow }) {
  const downloadHref = row.r2_key ? `/api/inbox/${row.id}/download` : null;
  return (
    <article
      key={row.id}
      className="bg-white rounded-lg border border-[#efefef] shadow-sm overflow-hidden"
    >
      <header className="flex items-start justify-between gap-4 px-4 py-3 border-b bg-[#fafafa]">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[#6b6b6b]">
            {new Date(row.received_at).toLocaleString()} · from{" "}
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
            Download .eml
          </a>
        ) : null}
      </header>
      <div className="px-4 py-4">
        <MessageBody row={row} />
      </div>
    </article>
  );
}

export default async function ClientInboxPage() {
  const rows = await listClientInbox(100);
  return (
    <div className="w-full p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-[#232323]">Inbox</h1>
        <p className="text-sm text-[#6b6b6b] mt-1">
          Mail received at your VIZA inbox alias on your behalf. Remote
          images are blocked by default — download the raw message if
          you want to inspect anything we hide.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-[#9ca3af]">
          No mail yet — your alias is configured but no messages have arrived.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <MessageRow key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
