import { CircleFlag } from "react-circle-flags";

/**
 * Some regional-indicator flag emoji (notably 🇹🇼 Taiwan) render as a broken
 * "tofu" box on systems whose emoji font omits them for political reasons
 * (e.g. Windows' Segoe UI Emoji). Rather than switching every destination
 * card to an image-based flag, this renders an actual SVG flag (via the
 * already-installed `react-circle-flags` package, same one used by
 * components/client/travel/travel-planner-form.tsx) only for the specific
 * emoji known to be affected, and falls back to the plain emoji text for
 * everyone else.
 */
const EMOJI_FLAG_ISO2_OVERRIDES: Record<string, string> = {
  "🇹🇼": "tw",
};

export function DestinationFlag({ flag, size = 34 }: { flag: string; size?: number }) {
  const iso2 = EMOJI_FLAG_ISO2_OVERRIDES[flag];
  if (iso2) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <CircleFlag countryCode={iso2} height={size} />
      </span>
    );
  }
  return (
    <span className="text-[34px] leading-none" aria-hidden="true">
      {flag}
    </span>
  );
}
