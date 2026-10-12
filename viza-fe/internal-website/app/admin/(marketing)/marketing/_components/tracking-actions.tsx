"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMarketingShortLink, setMarketingShortLinkActive } from "@/app/actions/admin-marketing";
import type { InterfaceLocale } from "@/lib/i18n/locale";

const COPY = {
  en: { destination: "HTTPS destination", campaign: "Campaign", content: "Content key (optional)", reason: "Operational reason", create: "Create short link", working: "Working…", deactivate: "Deactivate", activate: "Activate" },
  zh: { destination: "HTTPS 目标地址", campaign: "活动名称", content: "内容标识（可选）", reason: "运营原因", create: "创建短链接", working: "处理中…", deactivate: "停用", activate: "启用" },
} as const;

export function CreateTrackingLink({ locale }: { locale: InterfaceLocale }) {
  const copy = COPY[locale];
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  return (
    <form
      className="mkt-form-grid"
      action={(form) =>
        startTransition(async () => {
          const result = await createMarketingShortLink({
            destinationUrl: String(form.get("destinationUrl") ?? ""),
            campaign: String(form.get("campaign") ?? ""),
            contentKey: String(form.get("contentKey") ?? "") || undefined,
            reason: String(form.get("reason") ?? ""),
          });
          if (!result.success || !result.data) {
            setError(result.error ?? "Operation failed.");
            return;
          }
          setError(null);
          setCreated(result.data.shortUrl);
          router.refresh();
        })
      }
    >
      <label className="mkt-field">
        <span className="mkt-label">{copy.destination}</span>
        <input className="mkt-input" name="destinationUrl" type="url" required />
      </label>
      <label className="mkt-field">
        <span className="mkt-label">{copy.campaign}</span>
        <input className="mkt-input" name="campaign" required />
      </label>
      <label className="mkt-field">
        <span className="mkt-label">{copy.content}</span>
        <input className="mkt-input" name="contentKey" />
      </label>
      <label className="mkt-field">
        <span className="mkt-label">{copy.reason}</span>
        <input className="mkt-input" name="reason" required minLength={5} />
      </label>
      <div className="mkt-actions-row">
        <button className="mkt-btn mkt-btn--primary" disabled={pending}>
          {pending ? copy.working : copy.create}
        </button>
        {created ? (
          <a className="mkt-note" style={{ alignSelf: "center" }} href={created} target="_blank" rel="noreferrer">
            {created}
          </a>
        ) : null}
      </div>
      {error ? <p className="mkt-alert is-error mkt-field-wide">{error}</p> : null}
    </form>
  );
}

export function ToggleTrackingLink({ id, active, locale }: { id: string; active: boolean; locale: InterfaceLocale }) {
  const copy = COPY[locale];
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 180 }}>
      <input
        className="mkt-input"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        minLength={5}
        placeholder={copy.reason}
      />
      <button
        type="button"
        className={`mkt-btn mkt-btn--sm ${active ? "mkt-btn--danger" : "mkt-btn--secondary"}`}
        disabled={pending || reason.trim().length < 5}
        onClick={() =>
          startTransition(async () => {
            const result = await setMarketingShortLinkActive({ id, active: !active, reason });
            setError(result.success ? null : result.error ?? "Operation failed.");
            router.refresh();
          })
        }
      >
        {active ? copy.deactivate : copy.activate}
      </button>
      {error ? <p className="mkt-note mkt-note-down">{error}</p> : null}
    </div>
  );
}
