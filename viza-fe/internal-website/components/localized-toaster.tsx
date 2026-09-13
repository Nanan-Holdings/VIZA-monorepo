"use client";

import { Toaster } from "sonner";
import { useLocale } from "next-intl";

/**
 * Keep Sonner's screen-reader labels aligned with the active interface
 * language. Toast messages themselves are supplied by each feature.
 */
export function LocalizedToaster() {
  const locale = useLocale();
  const isZh = locale.toLowerCase().startsWith("zh");

  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      containerAriaLabel={isZh ? "通知" : "Notifications"}
      toastOptions={{
        closeButtonAriaLabel: isZh ? "关闭通知" : "Close notification",
      }}
    />
  );
}
