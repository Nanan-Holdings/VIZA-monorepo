"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { trackEvent } from "@/lib/analytics";

/**
 * Contact form posting to /api/contact (proxied to the portal, which needs a name, an email and a message).
 * "short" is the Framer CTA form (name, email, message); "full" adds phone and destination for /contact.
 * Keeps the honeypot, the success and error states and the lead_submit event of the earlier form.
 */
export default function ContactForm({ variant = "short", formId }: { variant?: "short" | "full"; formId: string }) {
  const t = useTranslations("ds.form");
  const locale = useLocale();
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: data.get("fullName"),
          email: data.get("email"),
          phone: data.get("phone") ?? "",
          destination: data.get("destination") ?? "",
          reasons: [],
          message: data.get("message"),
          website: data.get("website"),
          locale,
        }),
      });
      const json = (await res.json()) as { ok?: boolean };
      if (!res.ok || !json.ok) throw new Error("send failed");
      setStatus("success");
      trackEvent("lead_submit", { form_id: formId, reason_count: 0, locale });
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  const field = (name: string, type: string, required = false) => (
    <label className="ds-field">
      <span className="ds-label">{t(`${name}.label`)}</span>
      {type === "textarea" ? (
        <textarea className="ds-input" name={name} required={required} placeholder={t(`${name}.placeholder`)} rows={4} />
      ) : (
        <input
          className="ds-input"
          type={type}
          name={name}
          required={required}
          placeholder={t(`${name}.placeholder`)}
          autoComplete={name === "fullName" ? "name" : name === "email" ? "email" : name === "phone" ? "tel" : "off"}
        />
      )}
    </label>
  );

  return (
    <form className={`ds-form ds-form--${variant}`} onSubmit={submit}>
      {field("fullName", "text", true)}
      {field("email", "email", true)}
      {variant === "full" && (
        <div className="ds-form-row">
          {field("phone", "tel")}
          {field("destination", "text")}
        </div>
      )}
      {field("message", "textarea", true)}
      {/* Honeypot, hidden from people, filled by naive bots. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="ds-honeypot" />
      {status === "success" && (
        <p role="status" className="ds-form-note is-ok">
          {t("success")}
        </p>
      )}
      {status === "error" && (
        <p role="alert" className="ds-form-note is-error">
          {t("error")}
        </p>
      )}
      <button className="ds-btn ds-btn--block" type="submit" disabled={status === "sending"}>
        {status === "sending" ? t("sending") : t("submit")}
      </button>
      <p className="ds-caption ds-form-consent">
        {t.rich("consent", {
          privacy: (chunks) => <Link href="/legal/privacy">{chunks}</Link>,
          terms: (chunks) => <Link href="/legal/terms">{chunks}</Link>,
        })}
      </p>
    </form>
  );
}
