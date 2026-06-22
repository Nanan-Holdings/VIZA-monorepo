import Script from "next/script";

export const runtimeAbortErrorScript = `
(function () {
  function isAbortError(error) {
    var message = "";
    if (error && typeof error === "object") {
      if (error.name === "AbortError") return true;
      message = String(error.message || error.reason || "");
    } else {
      message = String(error || "");
    }
    message = message.toLowerCase();
    return message.indexOf("signal is aborted") !== -1 || message.indexOf("operation was aborted") !== -1;
  }

  window.addEventListener("unhandledrejection", function (event) {
    if (!isAbortError(event.reason)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  window.addEventListener("error", function (event) {
    if (!isAbortError(event.error || event.message)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
})();`;

export function RuntimeAbortErrorScript() {
  return (
    <Script
      id="runtime-abort-error-guard"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{ __html: runtimeAbortErrorScript }}
    />
  );
}
