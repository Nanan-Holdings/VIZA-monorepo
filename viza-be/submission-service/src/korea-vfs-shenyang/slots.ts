export interface ShenyangVfsSlot {
  id: string;
  appointment_date: string;
  appointment_time: string;
  appointment_location: string;
  appointment_type: string;
  source: "official_vfs_korea_shenyang";
  status: "observed";
  metadata_redacted_json: {
    providerSlotKey: string;
    observedAt: string;
  };
}

export function toShenyangVfsIsoDate(raw: string): string | null {
  const value = raw.replace(/[,]/gu, " ").replace(/\s+/gu, " ").trim();
  const iso = value.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/u);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const dmy = value.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/u);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const named = value.match(/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2})\b/iu);
  if (!named) return null;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const month = months.indexOf(named[2].slice(0, 3).toLowerCase()) + 1;
  return `${named[3]}-${String(month).padStart(2, "0")}-${named[1].padStart(2, "0")}`;
}

export function extractShenyangVfsSlotsFromTexts(texts: string[], observedAt = new Date().toISOString()): ShenyangVfsSlot[] {
  const slots: ShenyangVfsSlot[] = [];
  for (const raw of texts) {
    const text = raw.replace(/\s+/gu, " ").trim();
    const date = toShenyangVfsIsoDate(text);
    const time = text.match(/\b([01]?\d|2[0-3]):[0-5]\d(?:\s?[AP]M)?\b/iu)?.[0]?.toUpperCase() ?? null;
    if (!date || !time || /unavailable|fully booked|closed|disabled/i.test(text)) continue;
    const providerSlotKey = `${date}T${time}`;
    slots.push({
      id: `shenyang-${date}-${time.replace(/[^0-9APM]/giu, "").toLowerCase()}`,
      appointment_date: date,
      appointment_time: time,
      appointment_location: "Korea Visa Application Center Shenyang",
      appointment_type: "C-3-9 document intake",
      source: "official_vfs_korea_shenyang",
      status: "observed",
      metadata_redacted_json: { providerSlotKey, observedAt },
    });
  }
  return slots.filter((slot, index) => slots.findIndex((candidate) => candidate.metadata_redacted_json.providerSlotKey === slot.metadata_redacted_json.providerSlotKey) === index);
}
