import { CircleFlag } from "react-circle-flags";

const REGIONAL_INDICATOR_A = 0x1f1e6;

function getFlagCountryCode(flag: string): string | null {
  const characters = Array.from(flag);
  if (characters.length !== 2) return null;

  const countryCode = characters
    .map((character) => character.codePointAt(0))
    .map((codePoint) => {
      if (codePoint === undefined) return "";
      const alphabetIndex = codePoint - REGIONAL_INDICATOR_A;
      return alphabetIndex >= 0 && alphabetIndex < 26
        ? String.fromCharCode(97 + alphabetIndex)
        : "";
    })
    .join("");

  return countryCode.length === 2 ? countryCode : null;
}

export function DestinationFlag({ flag, size = 34 }: { flag: string; size?: number }) {
  const iso2 = getFlagCountryCode(flag);
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
