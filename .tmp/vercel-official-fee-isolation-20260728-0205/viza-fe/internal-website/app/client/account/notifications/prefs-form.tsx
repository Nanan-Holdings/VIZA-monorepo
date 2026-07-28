"use client";

import { useState, useTransition } from "react";
import type { NotificationPrefs } from "@/app/actions/notification-prefs";

interface Props {
  initial: NotificationPrefs;
  action: (patch: Record<string, boolean>) => Promise<void>;
}

const FIELDS: Array<{
  key: keyof NotificationPrefs;
  label: string;
  hint?: string;
}> = [
  {
    key: "channel_email",
    label: "Email notifications",
    hint: "Always on for essential events; toggling off only mutes optional ones.",
  },
  { key: "channel_push", label: "Mobile push notifications", hint: "Requires the VIZA mobile app." },
  { key: "notify_runner_started", label: "Submission started" },
  { key: "notify_submitted", label: "Submission complete" },
  { key: "notify_document_ready", label: "Visa document ready" },
  { key: "notify_marketing", label: "Product news + offers (opt-in)" },
];

export function NotificationPrefsForm({ initial, action }: Props) {
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
      setSavedAt(new Date().toLocaleTimeString());
    });
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {FIELDS.map((f) => {
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
        <p className="text-xs text-[#6b6b6b]">Saved at {savedAt}.</p>
      ) : null}
    </div>
  );
}
