"use client";

import { useState, useTransition } from "react";
import { useLocale } from "next-intl";
import type { NotificationPrefs } from "@/app/actions/notification-prefs";
import { getNotificationsCopy } from "./copy";

interface Props {
  initial: NotificationPrefs;
  action: (patch: Record<string, boolean>) => Promise<void>;
}

export function NotificationPrefsForm({ initial, action }: Props) {
  const locale = useLocale();
  const copy = getNotificationsCopy(locale);
  const [state, setState] = useState<NotificationPrefs>(initial);
  const [pending, start] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);

  function toggle(key: keyof NotificationPrefs) {
    if (typeof state[key] !== "boolean") return;
    const next = !state[key];
    const patch = { [key]: next } as Record<string, boolean>;
    setState((s) => ({ ...s, [key]: next }));
    start(async () => {
      await action(patch);
      setSavedAt(new Date().toLocaleTimeString(locale.startsWith("zh") ? "zh-CN" : "en-US"));
    });
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {[
          { key: "channel_email" as const, ...copy.fields.channelEmail },
          { key: "channel_push" as const, ...copy.fields.channelPush },
          { key: "notify_runner_started" as const, label: copy.fields.submissionStarted, hint: undefined },
          { key: "notify_submitted" as const, label: copy.fields.submissionComplete, hint: undefined },
          { key: "notify_document_ready" as const, label: copy.fields.visaDocumentReady, hint: undefined },
          { key: "notify_marketing" as const, label: copy.fields.marketing, hint: undefined },
        ].map((f) => {
          const value = Boolean(state[f.key]);
          return (
            <li
              key={f.key}
              className="flex items-start justify-between bg-white border border-[#efefef] rounded p-3"
            >
              <div>
                <p className="font-medium text-[#232323] text-sm">{f.label}</p>
                {f.hint ? (
                  <p className="text-xs text-[#6b6b6b] mt-0.5">{f.hint}</p>
                ) : null}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={value}
                aria-label={f.label}
                onClick={() => toggle(f.key)}
                disabled={pending}
                className={`relative w-10 h-6 rounded-full transition-colors ${
                  value ? "bg-black" : "bg-[#d1d5db]"
                } disabled:opacity-50`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    value ? "translate-x-4" : ""
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>
      {savedAt ? (
        <p className="text-xs text-[#6b6b6b]">{copy.savedAt(savedAt)}</p>
      ) : null}
    </div>
  );
}
