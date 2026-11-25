/** Adds `ds-js` to <html> before first paint, so reveal elements start hidden only when scripts run. */
export default function MotionScript() {
  return <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('ds-js')" }} />;
}
