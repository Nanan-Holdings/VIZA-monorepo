export function formatOfficialFlightDisplayLabel(flightNumber: string, airport = ""): string {
  const compact = flightNumber.replace(/\s+/g, "");
  const match = /^([A-Za-z]{2})(\d+)$/.exec(compact);
  let displayNumber = compact;

  if (match) {
    const [, airline, digits] = match;
    if (digits.length < 4) {
      displayNumber = `${airline}${digits} (${airline}${digits.padStart(4, "0")})`;
    } else if (digits.length === 4) {
      const unpaddedDigits = digits.replace(/^0+(?!$)/, "");
      displayNumber = unpaddedDigits === digits
        ? `${airline}${digits}`
        : `${airline}${unpaddedDigits} (${airline}${digits})`;
    }
  }

  return airport ? `${displayNumber} - ${airport}` : displayNumber;
}
